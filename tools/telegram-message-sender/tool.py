# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Any, Optional, List, Dict
from os.path import isfile
import requests


class CONFIG:
    # Telegram bot token obtained from BotFather.
    # Required. Must be a non-empty string.
    bot_token: str

    # Telegram chat identifier where the bot will send messages.
    # Supported formats:
    #   - int: numeric chat ID (recommended for private chats / privacy mode)
    #   - str numeric: e.g. "123456789" or "-100123456789" (will be converted to int)
    #   - str username: "mychannel" or "@mychannel" (will be normalized to "@mychannel")
    # NOTES for bots in privacy mode:
    #   - For private chats, you MUST use the numeric chat ID of a user who has already
    #     started the bot (sent at least one message to the bot).
    #   - Using a plain @username for a private user may result in "chat not found".
    # Required.
    chat_id: Any

    # Optional base URL for Telegram API.
    # Default (if not set or empty): "https://api.telegram.org"
    api_base_url: Optional[str]

    # Whether to verify that the configured chat_id exists and is accessible
    # by calling the Telegram getChat API method before sending.
    # If not present, defaults to True.
    validate_chat: Optional[bool]


class INPUTS:
    # Text message to send.
    # Optional. Whitespace-only text will be treated as not provided.
    # At least one of `text` (non-empty after trimming) or `attachment_paths`
    # (with one or more valid files) must be provided.
    text: Optional[str]

    # Parse mode for text messages and captions.
    # Typical values: "Markdown", "MarkdownV2", "HTML"
    # Optional.
    parse_mode: Optional[str]

    # Optional flag to send messages silently.
    # If True, the message will be sent without sound.
    disable_notification: Optional[bool]

    # Optional list of file paths to attach and send as documents.
    # Each path must point to a readable file on disk.
    # If provided and non-empty, files will be sent via sendDocument.
    # If provided but empty (i.e. []), it is treated as "no attachments".
    attachment_paths: Optional[List[str]]

    # Optional list of captions for the attachment files.
    # If provided and non-empty, its length must match `attachment_paths` length.
    # If shorter or longer, behavior is considered invalid and will result in error.
    # Can contain None values for files without caption.
    # If it is an empty list, it is treated as "no captions".
    attachment_captions: Optional[List[Optional[str]]]


class OUTPUT:
    # True if all messages/attachments were sent successfully, False otherwise.
    success: bool

    # Human-readable status or error message.
    message: str

    # Raw Telegram API responses for debugging or logging purposes.
    # Each item is a dict returned from the Telegram API.
    telegram_responses: List[Dict[str, Any]]


async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    output = OUTPUT()
    output.success = False
    output.message = ""
    output.telegram_responses = []

    # -------------------------
    # Config validation
    # -------------------------

    bot_token = getattr(config, "bot_token", None)
    if not bot_token or not isinstance(bot_token, str) or not bot_token.strip():
        output.message = "Invalid configuration: 'bot_token' must be a non-empty string."
        return output

    if not hasattr(config, "chat_id"):
        output.message = "Invalid configuration: 'chat_id' is required in CONFIG."
        return output
    raw_chat_id = getattr(config, "chat_id")

    # Normalize chat_id:
    # - If int, keep as-is.
    # - If numeric string, convert to int.
    # - Otherwise, treat as username and ensure it starts with "@".
    def normalize_chat_id(value: Any) -> Any:
        if isinstance(value, int):
            return value
        if isinstance(value, str):
            s = value.strip()
            if not s:
                return None
            # Numeric (possibly negative, for supergroups/channels)
            if s.lstrip("-").isdigit():
                try:
                    return int(s)
                except ValueError:
                    return None
            # Non-numeric: assume username
            if not s.startswith("@"):
                s = "@" + s
            return s
        return None

    chat_id = normalize_chat_id(raw_chat_id)
    if chat_id is None:
        output.message = (
            "Invalid configuration: 'chat_id' must be an int, a numeric string, "
            "or a username like '@mychannel'."
        )
        return output

    api_base_url = getattr(config, "api_base_url", None)
    if not api_base_url or not isinstance(api_base_url, str) or not api_base_url.strip():
        api_base_url = "https://api.telegram.org"
    api_base_url = api_base_url.rstrip("/")

    validate_chat = getattr(config, "validate_chat", True)
    if not isinstance(validate_chat, bool):
        validate_chat = True

    # -------------------------
    # Inputs validation
    # -------------------------

    text = getattr(inputs, "text", None)
    parse_mode = getattr(inputs, "parse_mode", None)
    disable_notification = getattr(inputs, "disable_notification", None)
    attachment_paths = getattr(inputs, "attachment_paths", None)
    attachment_captions = getattr(inputs, "attachment_captions", None)

    # Normalize text: treat empty/whitespace-only as no text
    normalized_text: Optional[str] = None
    if text is not None:
        stripped = str(text).strip()
        if stripped:
            normalized_text = stripped

    # Validate attachments
    if attachment_paths is not None:
        if not isinstance(attachment_paths, list):
            output.message = "Invalid inputs: 'attachment_paths' must be a list of file paths if provided."
            return output
        for p in attachment_paths:
            if not isinstance(p, str) or not p.strip():
                output.message = "Invalid inputs: All 'attachment_paths' entries must be non-empty strings."
                return output
            if not isfile(p):
                output.message = f"Invalid inputs: Attachment file does not exist: {p}"
                return output

    # Validate captions
    if attachment_captions is not None:
        if not isinstance(attachment_captions, list):
            output.message = "Invalid inputs: 'attachment_captions' must be a list if provided."
            return output
        # Only enforce relationship with attachment_paths if there is at least one caption entry.
        if len(attachment_captions) > 0:
            if not attachment_paths or len(attachment_paths) == 0:
                output.message = (
                    "Invalid inputs: 'attachment_captions' provided but 'attachment_paths' is empty or missing."
                )
                return output
            if len(attachment_captions) != len(attachment_paths):
                output.message = (
                    "Invalid inputs: 'attachment_captions' length must match 'attachment_paths' length."
                )
                return output

    # Determine if there are actual attachments
    has_attachments = bool(attachment_paths) and len(attachment_paths) > 0

    # Ensure we have something to send:
    #   - non-empty text OR
    #   - at least one attachment file
    if normalized_text is None and not has_attachments:
        output.message = (
            "Invalid inputs: You must provide a non-empty 'text' message or at least one file in 'attachment_paths'."
        )
        return output

    base_url = f"{api_base_url}/bot{bot_token}"

    # -------------------------
    # Helper for Telegram calls
    # -------------------------

    def send_telegram_request(
        method: str,
        data: Optional[Dict[str, Any]] = None,
        files: Optional[Dict[str, Any]] = None,
        use_get: bool = False,
    ) -> Optional[Dict[str, Any]]:
        url = f"{base_url}/{method}"
        try:
            if use_get:
                response = requests.get(url, params=data, timeout=30)
            else:
                response = requests.post(url, data=data, files=files, timeout=30)
        except requests.RequestException as e:
            output.telegram_responses.append({"ok": False, "error": str(e), "method": method})
            return None

        try:
            json_data = response.json()
        except ValueError:
            json_data = {
                "ok": False,
                "status_code": response.status_code,
                "text": response.text,
                "method": method,
            }

        output.telegram_responses.append(json_data)

        if not response.ok or not json_data.get("ok", False):
            return None
        return json_data

    # -------------------------
    # Optional chat validation
    # -------------------------

    if validate_chat:
        chat_check = send_telegram_request("getChat", data={"chat_id": chat_id}, use_get=True)
        if chat_check is None:
            # Provide a more helpful message for common "chat not found" error.
            last_resp = output.telegram_responses[-1] if output.telegram_responses else {}
            desc = last_resp.get("description", "")
            if "chat not found" in desc.lower():
                output.message = (
                    "Telegram API error: chat not found. For bots in privacy mode, make sure:\n"
                    "- The configured 'chat_id' is the numeric ID of a chat/user that has already "
                    "started the bot or where the bot is a member.\n"
                    "- Using plain usernames for private users is not supported; you must use the "
                    "numeric chat ID obtained from an incoming update."
                )
            else:
                output.message = (
                    f"Failed to validate 'chat_id' with Telegram API. Response: {desc or 'unknown error'}"
                )
            return output

    # -------------------------
    # Send text message (if any)
    # -------------------------

    if normalized_text is not None:
        text_payload: Dict[str, Any] = {"chat_id": chat_id, "text": normalized_text}
        if parse_mode:
            text_payload["parse_mode"] = parse_mode
        if isinstance(disable_notification, bool):
            text_payload["disable_notification"] = disable_notification

        msg_result = send_telegram_request("sendMessage", data=text_payload)
        if msg_result is None:
            last_resp = output.telegram_responses[-1] if output.telegram_responses else {}
            desc = last_resp.get("description", "")
            output.message = (
                "Failed to send text message via Telegram."
                + (f" Telegram response: {desc}" if desc else "")
            )
            return output

    # -------------------------
    # Send attachments (if any)
    # -------------------------

    if has_attachments:
        for idx, file_path in enumerate(attachment_paths):
            caption: Optional[str] = None
            if attachment_captions and idx < len(attachment_captions):
                caption_value = attachment_captions[idx]
                if caption_value is not None:
                    caption = str(caption_value)

            data: Dict[str, Any] = {"chat_id": chat_id}
            if caption is not None:
                data["caption"] = caption
            if parse_mode:
                data["parse_mode"] = parse_mode
            if isinstance(disable_notification, bool):
                data["disable_notification"] = disable_notification

            # Send as document to support arbitrary file types.
            with open(file_path, "rb") as f:
                files_dict = {"document": (file_path, f)}
                doc_result = send_telegram_request("sendDocument", data=data, files=files_dict)
                if doc_result is None:
                    last_resp = output.telegram_responses[-1] if output.telegram_responses else {}
                    desc = last_resp.get("description", "")
                    output.message = (
                        f"Failed to send attachment: {file_path}."
                        + (f" Telegram response: {desc}" if desc else "")
                    )
                    return output

    # If we reach here, everything succeeded
    output.success = True
    if has_attachments and normalized_text is not None:
        output.message = "Text message and attachments sent successfully."
    elif has_attachments:
        output.message = "Attachments sent successfully."
    else:
        output.message = "Text message sent successfully."

    return output