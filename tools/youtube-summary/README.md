# Youtube Transcript Summarizer

## Name & Description
A tool that fetches the transcript of a YouTube video and generates a formatted summary using an LLM. It processes the video transcript into sections with timestamp links for easy navigation.

## Usage Example
Use Youtube Transcript Summarizer, with url: [YOUR_YOUTUBE_VIDEO_URL]

Or with language specification:
Use Youtube Transcript Summarizer, with url: [YOUR_YOUTUBE_VIDEO_URL], and lang: [LANGUAGE_CODE]

## Parameters/Inputs
The following parameters are available:
- `url` (string, required): The URL of the YouTube video to summarize
- `lang` (string, optional): The language for the transcript (defaults to 'en')

## Config
This tool does not require any configuration options. The configuration object is empty.

## Output
The tool returns an object with the following field:
- `summary` (string, required): A markdown-formatted summary of the video, divided into sections with clickable timestamp links in the format: https://www.youtube.com/watch?v={video_id}&t={offset}
