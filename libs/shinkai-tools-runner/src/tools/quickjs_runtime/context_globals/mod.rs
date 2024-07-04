use rquickjs::{Ctx, Result};

mod console;
mod fetch;
mod timers;

pub fn init_globals(ctx: &Ctx<'_>) -> Result<()> {
    console::init(ctx)?;
    fetch::init(ctx)?;
    timers::init(ctx)?;
    Ok(())
}
