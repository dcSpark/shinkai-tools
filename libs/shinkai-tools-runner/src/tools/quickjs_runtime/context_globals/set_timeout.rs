use rquickjs::{Ctx, Function, Result};
use tokio::time::Duration;

pub fn set_timeout_spawn<'js>(ctx: Ctx<'js>, callback: Function<'js>, millis: usize) -> Result<()> {
    ctx.spawn(async move {
        tokio::time::sleep(Duration::from_millis(millis as u64)).await;
        callback.call::<_, ()>(()).unwrap();
    });

    Ok(())
}
