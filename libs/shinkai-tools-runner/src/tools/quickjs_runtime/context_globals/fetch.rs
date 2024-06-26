use std::str::FromStr;

use reqwest::{
    self,
    header::{HeaderMap, HeaderName, HeaderValue},
    Method,
};
use rquickjs::{Ctx, Function, IntoJs, Object, Promise, Result};

pub fn fetch<'js>(ctx: Ctx<'js>, url: String, options: Object<'js>) -> Result<Promise<'js>> {
    let (promise, resolve, reject) = ctx.promise()?;
    let ctx_clone = ctx.clone();
    ctx.spawn(async move {
        let method = options
            .get::<String, String>("method".to_string())
            .unwrap_or_else(|_| "GET".to_string());
        let headers = options.get::<String, Object>("headers".to_string());
        let body = match options.get::<String, Object>("body".to_string()) {
            Ok(body_object) => {
                let body_string = ctx_clone.json_stringify(body_object).unwrap().unwrap();
                Some(body_string.to_string().unwrap())
            }
            Err(_) => match options.get::<String, String>("body".to_string()) {
                Ok(body_string) => Some(body_string),
                Err(_) => None,
            },
        };

        let client = reqwest::Client::new();
        let mut request = client.request(Method::from_str(method.as_str()).unwrap(), url);
        let mut header_map = HeaderMap::new();
        if let Ok(headers_object) = headers {
            headers_object.props::<String, String>().for_each(|kv| {
                if let Ok((key, value)) = kv {
                    if let Ok(header_value) = HeaderValue::from_str(&value) {
                        if let Ok(header_name) = HeaderName::from_str(&key) {
                            header_map.insert(header_name, header_value);
                        }
                    }
                }
            });
        }
        request = request.headers(header_map);
        if let Some(body_string) = body {
            request = request.body(body_string);
        }
        match request.send().await {
            Ok(response) => {
                let status = response.status().as_str().into_js(&ctx_clone);
                let ok = response.status().is_success();
                let headers = Object::new(ctx_clone.clone()).unwrap();
                response.headers().iter().for_each(|(key, value)| {
                    let value = value.to_str().unwrap().to_string();
                    headers
                        .set(key.as_str(), value.into_js(&ctx_clone))
                        .unwrap();
                });
                match response.text().await {
                    Ok(body_text) => {
                        let body = ctx_clone.clone().json_parse(body_text).unwrap();
                        let response_to_js = Object::new(ctx_clone.clone()).unwrap();
                        response_to_js.set("status", status).unwrap();
                        response_to_js.set("ok", ok).unwrap();
                        response_to_js.set("headers", headers.clone()).unwrap();
                        response_to_js.set("body", body.clone()).unwrap();

                        // Add json() method
                        let body_clone = body.clone();
                        let json_fn = Function::new(ctx_clone.clone(), move || {
                            Ok::<_, rquickjs::Error>(body_clone.clone())
                        }).unwrap();
                        response_to_js.set("json", json_fn).unwrap();

                        let _ = resolve.call::<_, ()>((response_to_js,));
                    }
                    Err(error) => {
                        reject.call::<_, ()>((error.to_string(),)).unwrap();
                    }
                }
            }
            Err(error) => {
                reject.call::<_, ()>((error.to_string(),)).unwrap();
            }
        }
    });
    Ok(promise)
}
