use std::time::Duration;

use derivative::Derivative;
use derive_more::Into;
use derive_more::{Deref, DerefMut, From};
use rquickjs::function::Opt;
use rquickjs::{class::Trace, function::Func, Ctx, Function, Result};

use tokio_util::sync::CancellationToken;

#[derive(Trace, Derivative, From, Into, Deref, DerefMut)]
#[derivative(Clone, Debug)]
#[rquickjs::class(rename = "CancellationToken")]
struct CancellationTokenWrapper {
    #[qjs(skip_trace)]
    pub token: CancellationToken,
}

#[rquickjs::methods]
impl CancellationTokenWrapper {}

fn clear_timeout(_: Ctx, token: CancellationTokenWrapper) -> Result<()> {
    token.token.cancel();
    Ok(())
}

fn set_timeout<'js>(
    ctx: Ctx<'js>,
    callback: Function<'js>,
    delay_ms: Opt<u64>,
) -> Result<CancellationTokenWrapper> {
    let cancellation_token = CancellationToken::new();
    let cancellation_token_clone = cancellation_token.clone();
    let delay: u64 = delay_ms.unwrap_or(0);
    println!("Calling setTimeout with {} ms", delay);
    ctx.spawn(async move {
        tokio::select! {
            _ = cancellation_token_clone.cancelled() => {
                println!("cancelling setTimeout");
            }
            _ = tokio::time::sleep(Duration::from_millis(delay)) => {
                println!("calling setTimeout callback after {} ms", delay);
                if let Err(e) = callback.call::<_, ()>(()) {
                    println!("error calling callback: {}", e);
                }
            }
        }
    });
    Ok(CancellationTokenWrapper {
        token: cancellation_token,
    })
}

fn set_interval<'js>(
    ctx: Ctx<'js>,
    callback: Function<'js>,
    delay_ms: Option<u64>,
) -> Result<CancellationTokenWrapper> {
    let cancellation_token = CancellationToken::new();
    let cancellation_token_clone = cancellation_token.clone();
    let delay = delay_ms.unwrap_or(0);
    println!("Calling setInterval with {} ms", delay);
    let mut interval = tokio::time::interval(Duration::from_millis(delay));
    ctx.spawn(async move {
        loop {
            tokio::select! {
                _ = cancellation_token_clone.cancelled() => {
                    println!("cancelling setInterval");
                    break;
                }
                _ = interval.tick() => {
                    println!("interval tick {} ms", delay);
                    if let Err(e) = callback.call::<_, ()>(()) {
                        println!("error calling callback: {}", e);
                    }
                }
            }
        }
    });
    Ok(CancellationTokenWrapper {
        token: cancellation_token,
    })
}

pub fn init(ctx: &Ctx<'_>) -> Result<()> {
    let globals = ctx.globals();
    let _ = globals.set("setTimeout", Func::from(set_timeout));
    let _ = globals.set("clearTimeout", Func::from(clear_timeout));
    let _ = globals.set("setInterval", Func::from(set_interval));
    let _ = globals.set("clearInterval", Func::from(clear_timeout));
    Ok(())
}
