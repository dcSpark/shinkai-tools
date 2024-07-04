use derivative::Derivative;
use derive_more::From;
use derive_more::Into;
use reqwest::{
    self,
    header::{HeaderMap, HeaderName, HeaderValue},
    Method,
};
use rquickjs::function::Opt;
use rquickjs::{class::Trace, function::Func, Ctx, Object, Promise, Result};
use std::collections::HashMap;
use std::str::FromStr;

#[derive(Trace, Derivative, From, Into)]
#[derivative(Clone, Debug)]
#[rquickjs::class(rename = "Response")]
pub struct Response {
    #[qjs(get)]
    pub headers: HashMap<String, String>,

    #[qjs(get)]
    pub ok: bool,

    #[qjs(get)]
    pub status: u16,

    #[qjs(rename = "statusText")]
    pub status_text: String,

    // nyi
    // type: ResponseType,
    #[qjs(get)]
    pub url: String,

    #[qjs(get)]
    pub redirected: bool,

    #[qjs(get)]
    pub body: Option<Vec<u8>>,

    #[qjs(get)]
    #[qjs(rename = "bodyUsed")]
    pub body_used: bool,
}

#[rquickjs::methods]
impl Response {
    pub fn json<'js>(&self, ctx: Ctx<'js>) -> Result<Promise<'js>> {
        let (promise, resolve, reject) = ctx.promise()?;
        if let Some(body) = self.body.clone() {
            let body_string = String::from_utf8_lossy(&body);
            match ctx.json_parse(&*body_string) {
                Ok(json_value) => resolve.call((json_value,)),
                Err(_) => reject.call::<_, ()>(("No body to parse as JSON",)),
            }?;
        } else {
            reject.call::<_, ()>(("Empty body",))?;
        }
        Ok(promise)
    }

    pub fn text<'js>(&self, ctx: Ctx<'js>) -> Result<Promise<'js>> {
        let (promise, resolve, reject) = ctx.promise()?;
        if let Some(body) = self.body.clone() {
            let body_string = String::from_utf8_lossy(&body);
            resolve.call::<_, ()>((&*body_string,))?;
        } else {
            reject.call::<_, ()>(("Empty body",))?;
        }
        Ok(promise)
    }

    // NYI
    // fn array_buffer(&self) -> Promise<ArrayBuffer> {
    //     // Implementation here
    // }

    // fn blob(&self) -> Promise<Blob> {
    //     // Implementation here
    // }

    // fn formData(&self) -> Promise<FormData> {
    //     // Implementation here
    // }
}

fn fetch<'js>(ctx: Ctx<'js>, url: String, options: Opt<Object<'js>>) -> Result<Promise<'js>> {
    let url_clone = url.clone();
    let (promise, resolve, reject) = ctx.promise()?;
    let ctx_clone = ctx.clone();
    let options = if options.0.is_some() {
        options.0.unwrap()
    } else {
        Object::new(ctx.clone()).unwrap()
    };
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
                // let status = response.status().as_str().into_js(&ctx_clone);
                let mut headers = HashMap::<String, String>::new();
                response.headers().iter().for_each(|(key, value)| {
                    let value = value.to_str().unwrap().to_string();
                    headers.insert(key.as_str().to_string(), value);
                });

                let ok = response.status().is_success();
                let status = response.status().as_u16();
                let status_text = response.status().as_str().to_string();
                let redirected = response.status().is_redirection();
                let body = response.bytes().await.ok().map(|b| b.to_vec()).unwrap();

                resolve
                    .call::<(_,), ()>((Response {
                        headers,
                        ok,
                        status,
                        status_text,
                        url: url_clone,
                        redirected,
                        body: Some(body),
                        body_used: true,
                    },))
                    .unwrap();
            }
            Err(error) => {
                reject.call::<_, ()>((error.to_string(),)).unwrap();
            }
        }
    });
    Ok(promise)
}

pub fn init(ctx: &Ctx<'_>) -> Result<()> {
    let globals = ctx.globals();
    let _ = globals.set("fetch", Func::from(fetch));
    Ok(())
}
