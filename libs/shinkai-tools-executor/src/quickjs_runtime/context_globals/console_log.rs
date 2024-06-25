use rquickjs::{
    Ctx, IntoJs, Null, Result, Value
};

pub fn console_log<'js>(ctx: Ctx<'js>, val: Value<'js>) -> Result<()> {
    let str = match ctx.json_stringify_replacer_space(val, Null, "  ".into_js(&ctx))? {
        Some(str) => str.to_string(),
        None => Ok("undefined".into()),
    }?;
    println!("from js: {}", str);
    Ok(())
}
