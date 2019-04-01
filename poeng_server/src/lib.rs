mod ball;
mod game;
mod message;
mod player;

use game::Game;
use message::Message;
use player::Player;
use std::ops::DerefMut;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime};
use uuid::Uuid;

pub struct Config {
    url: String,
}

impl Config {
    pub fn new(args: &[String]) -> Result<Config, &'static str> {
        if args.len() < 2 {
            return Err("Not enough arguments");
        }

        let url = args[1].clone();

        Ok(Config { url })
    }
}

pub fn run(config: Config) {
    let games: Arc<Mutex<Vec<Game>>> = Arc::new(Mutex::new(vec![]));
    let waiting: Arc<Mutex<Option<Player>>> = Arc::new(Mutex::new(None));

    let games_clone = games.clone();
    thread::spawn(move || {
        let games = games_clone;

        loop {
            {
                let mut games_guard = games.lock().unwrap();
                games_guard.retain(Game::is_active);
                for g in games_guard.iter_mut() { g.tick() }
            }

            thread::sleep(Duration::from_millis(20));
        }
    });

    ws::listen(config.url, move |out| {
        let games = games.clone();
        let waiting = waiting.clone();

        move |msg: ws::Message| {
            let games = games.clone();
            let waiting = waiting.clone();

            let msg = match msg.as_text() {
                Ok(msg) => msg,
                Err(_) => "",
            };

            out.send(ws::Message::Text(match Message::from(msg) {
                Some((msg, command)) => format!("{} {}", command, response(msg, games, waiting)),
                None => "err".to_string(),
            }))
        }
    })
    .unwrap();
}

fn response(
    msg: Message,
    games: Arc<Mutex<Vec<Game>>>,
    waiting: Arc<Mutex<Option<Player>>>,
) -> String {
    let mut games_guard = games.lock().unwrap();

    match msg {
        Message::Register => Uuid::new_v4().to_string(),
        Message::Play(id) => match game::find_game(id, &games_guard) {
            Some(_) => "ok".to_string(),
            None => {
                let mut waiting_guard = waiting.lock().unwrap();
                let waiting = waiting_guard.deref_mut();

                if waiting.is_some() {
                    if waiting.as_ref().unwrap().id == id {
                        "wait".to_string()
                    } else {
                        let game = Game::new(waiting.take().unwrap(), Player::new(id));
                        games_guard.push(game);
                        "ok".to_string()
                    }
                } else {
                    let player = Player::new(id);
                    *waiting = Some(player);
                    "wait".to_string()
                }
            }
        },
        Message::Config(id) => match game::find_game(id, &games_guard) {
            Some(game) => format!("{} {} {}", game.width, game.height, game.pad_height),
            None => "err".to_string(),
        },
        Message::Side(id) => match game::find_game(id, &games_guard) {
            Some(game) => {
                if id == game.left_player.id {
                    "left".to_string()
                } else {
                    "right".to_string()
                }
            }
            None => "err".to_string(),
        },
        Message::Opponent(id) => match game::find_game(id, &games_guard) {
            Some(game) => {
                if id == game.left_player.id {
                    game.right_player.y.to_string()
                } else {
                    game.left_player.y.to_string()
                }
            }
            None => "err".to_string(),
        },
        Message::Points(id) => match game::find_game(id, &games_guard) {
            Some(game) => format!("{} {}", game.left_player.points, game.right_player.points),
            None => "err".to_string(),
        },
        Message::Ball(id) => match game::find_game(id, &games_guard) {
            Some(game) => match &game.ball {
                Some(ball) => format!("{} {} {} {}", ball.x, ball.y, ball.vx, ball.vy),
                None => "err".to_string(),
            },
            None => "err".to_string(),
        },
        Message::Move(id, y) => match game::find_game_mut(id, &mut games_guard) {
            Some(mut game) => {
                if id == game.left_player.id {
                    game.left_player.y = y;
                } else {
                    game.right_player.y = y;
                }

                game.last_activity = SystemTime::now();

                "ok".to_string()
            }
            None => "err".to_string(),
        },
        Message::Exit(id) => {
            games_guard.retain(move |g| {
                id != g.left_player.id &&
                id != g.right_player.id
            });
            "ok".to_string()
        }
    }
}
