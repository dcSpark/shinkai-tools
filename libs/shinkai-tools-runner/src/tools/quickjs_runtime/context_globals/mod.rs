use rquickjs::{Ctx, Result};

mod console;
mod fetch;
mod timers;
mod text_encoder_decoder;

pub fn init_globals(ctx: &Ctx<'_>) -> Result<()> {
    console::init(ctx)?;
    fetch::init(ctx)?;
    timers::init(ctx)?;
    text_encoder_decoder::init(ctx)?;
    Ok(())
}
