// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
// https://github.com/awslabs/llrt/blob/main/llrt_core/src/modules/

use rquickjs::{class::Trace, Array, Class, Ctx, Result, Value};
use rquickjs::{function::Opt, Exception, Object, TypedArray};

use super::utils::result::ResultExt;

#[derive(Trace)]
#[rquickjs::class]
pub struct TextEncoder {}

#[rquickjs::methods(rename_all = "camelCase")]
impl TextEncoder {
    #[qjs(constructor)]
    pub fn new() -> Self {
        Self {}
    }

    #[qjs(get)]
    fn encoding(&self) -> &str {
        "utf-8"
    }

    pub fn encode<'js>(&self, ctx: Ctx<'js>, string: Opt<Value<'js>>) -> Result<Value<'js>> {
        if let Some(string) = string.0 {
            if let Some(string) = string.as_string() {
                let string = string.to_string()?;
                eprintln!("String to encode: {}", string);
                return TypedArray::new(ctx.clone(), string.as_bytes())
                    .map(|m: TypedArray<'_, u8>| m.into_value());
            } else if !string.is_undefined() {
                eprintln!("The \"string\" argument must be a string.");
                return Err(Exception::throw_message(
                    &ctx,
                    "The \"string\" argument must be a string.",
                ));
            }
        }

        eprintln!("Encoding empty string");
        TypedArray::new(ctx.clone(), []).map(|m: TypedArray<'_, u8>| m.into_value())
    }

    pub fn encode_into<'js>(
        &self,
        ctx: Ctx<'js>,
        src: String,
        dst: Value<'js>,
    ) -> Result<Object<'js>> {
        if let Ok(typed_array) = TypedArray::<u8>::from_value(dst) {
            let dst_length = typed_array.len();
            let dst_offset: usize = typed_array.get("byteOffset")?;
            let array_buffer = typed_array.arraybuffer()?;
            let raw = array_buffer
                .as_raw()
                .ok_or("ArrayBuffer is detached")
                .or_throw(&ctx)?;

            let dst = unsafe {
                std::slice::from_raw_parts_mut(raw.ptr.as_ptr().add(dst_offset), dst_length)
            };

            let mut written = 0;
            let dst_len = dst.len();
            for ch in src.chars() {
                let len = ch.len_utf8();
                if written + len > dst_len {
                    break;
                }
                written += len;
            }
            dst[..written].copy_from_slice(&src.as_bytes()[..written]);
            let read: usize = src[..written].chars().map(char::len_utf16).sum();

            let obj = Object::new(ctx)?;
            obj.set("read", read)?;
            obj.set("written", written)?;
            Ok(obj)
        } else {
            Err(Exception::throw_type(
                &ctx,
                "The \"dest\" argument must be an instance of Uint8Array.",
            ))
        }
    }
}

pub fn init(ctx: &Ctx<'_>) -> Result<()> {
    let globals = ctx.globals();
    Class::<TextEncoder>::define(&globals)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rquickjs::{Context, Runtime, Value};
    use crate::tools::quickjs_runtime::context_globals::text_decoder;
    use std::error::Error;

    #[test]
    fn test_text_encoder_decoder() -> std::result::Result<(), Box<dyn Error>> {
        let runtime = Runtime::new()?;
        let ctx = Context::full(&runtime)?;

        ctx.with(|ctx| {
            // Initialize the TextEncoder and TextDecoder classes
            init(&ctx)?;
            text_decoder::init(&ctx)?;

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
