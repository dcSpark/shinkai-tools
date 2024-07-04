use rquickjs::{function::Func, Ctx, IntoJs, Null, Object, Result, Value};

fn console_log<'js>(ctx: Ctx<'js>, val: Value<'js>) -> Result<()> {
    let str = match ctx.json_stringify_replacer_space(val, Null, "  ".into_js(&ctx))? {
        Some(str) => str.to_string(),
        None => Ok("undefined".into()),
    }?;
    println!("from js: {}", str);
    Ok(())
}

pub fn init(ctx: &Ctx<'_>) -> Result<()> {
    let globals = ctx.globals();
    let console = Object::new(ctx.clone()).unwrap();
    let _ = console.set("log", Func::from(console_log));
    let _ = globals.set("console", console);
    Ok(())
}
