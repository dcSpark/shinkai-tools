// Defining a data model.
class YoutubeVideoSummary {
  url string @description("URL of the YouTube video")
  briefSummary string @description("Brief summary of the content")
  sections YoutubeVideoSummarySection[] @description("Key sections along the video")
}

// Defining a data model.
class YoutubeVideoSummarySection {
  url string @description("URL of the YouTube video for this section")
  offset int @description("offset in seconds where this section start in the video")
  title string @description("Title of this section")
  keyPoints string[] @description("key points of this section")
}

client<llm> LlmClient {
  provider "openai-generic"
  options {
    model "gpt-4o"
  }
}

// Creating a function to summarize a YouTube video
function SummarizeYoutubeVideo(youtubeVideoUrl: string, transcript: string) -> YoutubeVideoSummary {
  client LlmClient
  prompt #"
    {{ _.role("system") }}
    According to a transcription of a youtube video (which is in csv separated by ':::'):
  
    Write a brief summary of the video as instroduction.
    Then write more about the content divided in sections (at least 3) along the video.
    For every section define between 2-5 key points.
    For every section a links referencing where that section start in the video. The format for those links is https://www.youtube.com/watch?v={video_id}&t={offset} where 'offset' is a number and can be obtained from the transcription in csv format to generate the URL
    Format the answer using markdown.

    {{ ctx.output_format }}


    {{ _.role("user") }}
    Youtube Video Url:
    ---
    {{ youtubeVideoUrl }}
    ---

    Csv:
    ---
    {{ transcript }}
    ---
  "#
}

// Testing the function with a sample resume.
// test vaibhav_resume {
//   functions [ExtractResume]
//   args {
//     resume #"
//       Vaibhav Gupta
//       vbv@boundaryml.com

//       Experience:
//       - Founder at BoundaryML
//       - CV Engineer at Google
//       - CV Engineer at Microsoft

//       Skills:
//       - Rust
//       - C++
//     "#
//   }
// }
