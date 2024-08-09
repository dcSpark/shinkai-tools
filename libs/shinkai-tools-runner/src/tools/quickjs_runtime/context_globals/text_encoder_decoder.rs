use rquickjs::{class::Trace, Array, Class, Ctx, Result, Value};

#[derive(Trace)]
#[rquickjs::class]
pub struct TextEncoder {
    encoding: String,
}

impl Default for TextEncoder {
    fn default() -> Self {
        Self::new()
    }
}

#[rquickjs::methods]
impl TextEncoder {
    #[qjs(constructor)]
    pub fn new() -> Self {
        TextEncoder {
            encoding: "utf-8".to_string(),
        }
    }

    #[qjs(get)]
    pub fn encoding(&self) -> &str {
        &self.encoding
    }

    pub fn encode<'js>(&self, ctx: Ctx<'js>, input: String) -> Result<Value<'js>> {
        let utf8 = input.into_bytes();
        let array = Array::new(ctx.clone())?;
        for (i, byte) in utf8.iter().enumerate() {
            array.set(i, *byte)?;
        }
        Ok(array.into())
    }
}

#[derive(Trace)]
#[rquickjs::class]
pub struct TextDecoder {
    encoding: String,
}

impl Default for TextDecoder {
    fn default() -> Self {
        Self::new()
    }
}

#[rquickjs::methods]
impl TextDecoder {
    #[qjs(constructor)]
    pub fn new() -> Self {
        TextDecoder {
            encoding: "utf-8".to_string(),
        }
    }

    #[qjs(get)]
    pub fn encoding(&self) -> &str {
        &self.encoding
    }

    pub fn decode(&self, input: Vec<u8>) -> Result<String> {
        let decoded = String::from_utf8(input).map_err(|e| e.utf8_error())?;
        Ok(decoded)
    }
}

pub fn init(ctx: &Ctx<'_>) -> Result<()> {
    let globals = ctx.globals();
    Class::<TextEncoder>::define(&globals)?;
    Class::<TextDecoder>::define(&globals)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rquickjs::{Context, Runtime, Value};
    use std::error::Error;

    #[test]
    fn test_text_encoder_decoder() -> std::result::Result<(), Box<dyn Error>> {
        let runtime = Runtime::new()?;
        let ctx = Context::full(&runtime)?;

        ctx.with(|ctx| {
            // Initialize the TextEncoder and TextDecoder classes
            init(&ctx)?;

            let result: Value<'_> = ctx.eval(
                r#"
                let encoder = new TextEncoder();
                let decoder = new TextDecoder();

                let buffer = encoder.encode('hello');
                decoder.decode(buffer) == 'hello';
            "#,
            )?;

            assert!(result.as_bool().unwrap());
            Ok::<(), Box<dyn Error>>(())
        })?;
        Ok(())
    }
}
