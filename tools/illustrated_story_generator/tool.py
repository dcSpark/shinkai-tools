# /// script
# dependencies = [
#   "requests",
# ]
# ///

from typing import Any, Optional, List, Dict
from shinkai_local_tools import shinkai_llm_prompt_processor, text_to_image_generator_getimg_ai_flux_1, wait_1_5_seconds
import json
import asyncio

class CONFIG:
    num_scenes: int = 5
    show_scene_descriptions: bool = False
    show_style_instruction: bool = False

class INPUTS:
    story_description: str
    num_scenes: Optional[int] = None

class OUTPUT:
    story: str
    scene_descriptions: Optional[List[str]] = None
    style_instruction: Optional[str] = None
    story_reading_instructions_for_LLM: Optional[str] = None

DETAILED_IMAGE_PROMPT_GUIDE = """Detailed Guide on Prompting for Image Generation

This guide provides instructions and tips on how to write effective prompts for text-to-image generation models. It includes examples and techniques to help create images that closely match your vision.

---

## Basic Concepts of Writing Instructions

- **Maximum instruction length:** 480 tokens or 2048 characters.
- **Good instructions:** Descriptive, clear, and use meaningful modifiers and keywords.
- **Three key components to consider:**
  1. **Subject (Affair):** The main object, person, animal, or landscape you want to depict.
  2. **Context and background:** Where the subject is placed (e.g., studio, exterior, interior).
  3. **Style:** The artistic or photographic style (general or specific), e.g., painting, sketch, pastel painting, charcoal, isometric 3D, or combinations.

### Example of a prompt structure:

- *Image text:* A **Sketch** (style) of a **modern building** (subject) surrounded by **skyscrapers** (context and background).

### Iterative refinement:

- Start with a simple idea and add details in iterations until the image matches your vision.

#### Iteration example:

- Slogan: A park in the spring next to a lake
- Message 1: A park in spring next to a lake, the sun sets over the lake, golden hour
- Message 2: A park in spring next to a lake, sun sets over lake, golden hour, red wildflowers

---

## Instruction Length

- **Short instructions:** Quick image generation with basic details.
  - Example: *Close-up photo of a woman in her 20s, street photography, movie frame, warm muted orange tones*
- **Longer instructions:** Include more specific details for refined images.
  - Example: *Captivating photo of a woman in her 20s with a style of street photography. The image should look like a movie frame with warm muted orange tones.*

---

## Additional Tips for Writing Image Instructions

- Use **descriptive language**: Detailed adjectives and adverbs.
- Provide **context**: Reference information to clarify the scene.
- Mention **specific artists or styles** if you want a particular aesthetic.
- Explore **instruction engineering tools** for optimizing prompts.
- To enhance **facial details** in portraits or group images, use words like “portrait” explicitly.

---

## Generating Text in Images

- Text can be added to images, expanding creative possibilities.
- **Best practices:**
  - Limit text to **25 characters or less**.
  - Use up to **three sentences** for clarity.
  - Example: *A poster with the text “Summerland” in bold as the title, below this text is the slogan “Summer never felt so good”*
- Positioning of text may vary, and font styles can be suggested generally (not exact replication).
- Font size can be indicated as small, medium, or large.

---

## Instruction Parameterization

- To control output, you can create parameterized prompts with placeholders.
  
- Example template:
Use code with caution.
Python
A {logo_style} logo for a {company_area} company on a solid color background. Include the text {company_name}.
Generated code
- Sample parameterized instructions:

1. *A minimalist logo for a health care company on a solid color background. Include the text Journey.*
2. *A modern logo for a software company on a solid color background. Include the text Silo.*
3. *A traditional logo for a baking company on a solid color background. Include the text Seed.*

---

## Advanced Message Writing Techniques

### Photography Style Prompts

- Start with: **"A photo of..."**
- Examples:
- *A photo of coffee beans in a kitchen on a wooden surface*
- *A photo of a chocolate bar on a kitchen counter*
- *A photo of a modern building with water in the background*

### Photography Modifiers

Combine modifiers to control the image:

1. **Camera proximity:**

- *A photo in close-up of coffee beans*
- *A photo far away from a small bag of coffee beans in a messy kitchen*
2. **Camera position:**

- *Aerial photo from the urban city with skyscrapers*
- *A photo of a tree canopy with a blue sky from below*
3. **Lighting:**

- *Studio photo of a modern armchair, natural lighting*
- *Studio photo of a modern armchair, dramatic lighting*
4. **Camera settings:**

- *Photo of a city with skyscrapers from inside a car with motion blur*
- *Photo with soft focus from a bridge in an urban city at night*
5. **Lens types:**

- *Street photography, New York City, fisheye lens*
- *A polaroid portrait of a dog with sunglasses*
6. **Film types:**

- *A polaroid portrait of a dog with sunglasses*
- *Black and white photo of a dog with sunglasses*

---

### Illustration and Art

- Start with: **"A painting of..."** or **"A sketch of..."**
- Art styles can range from pencil sketches to digital art.
- Example prompt for the same subject with different styles:
- *A technical pencil drawing of an angular sports electric sedan with skyscrapers in the background*
- *A charcoal drawing of an angular sports electric sedan with skyscrapers in the background*
- *A colored pencil drawing of an angular sports electric sedan with skyscrapers in the background*
- *One pastel painting of an angular sports electric sedan with skyscrapers in the background*
- *Digital art of an angular sports electric sedan with skyscrapers in the background*
- *An art deco (a poster) of an angular sports electric sedan with skyscrapers in the background*

---

### Shapes and Materials

- Use phrases like “...made of...” or “...in the form of...”
- Examples:
- *A canvas bag done cheese*
- *Neon tubes in shape of a bird*
- *An armchair of paper, studio photo, origami style*

---

### References to Historical Art Styles

- Use: **"...in the style of..."**
- Examples:
- *Generate an image in the style of an impressionist painting: a wind farm*
- *Generate an image in the style of a Renaissance painting: a wind farm*
- *Generate an image in the style of pop art: a wind farm*

---

### Image Quality Modifiers

- Use keywords to specify quality level:

- General: *High quality, beautiful, stylized*
- Photos: *4K, HDR, studio photo*
- Illustration and art: *from a professional, detailed*
- Example:

- Without modifiers: *A photo of a corn stalk*
- With modifiers: *4K HDR beautiful photo of a corn stalk taken by a professional photographer*

---

### Aspect Ratios: Framing Your Scene and Feeling

Choosing an aspect ratio is more than a technical decision; it's a creative one. The shape of your frame fundamentally changes how a viewer perceives the image, influencing the mood, focus, and story. Here’s how to use different aspect ratios to achieve the perfect look and feel.

1. Square (1:1)
Best For & Emotional Impact:
Scenes: Portraits, single-subject focus, food photography, minimalist compositions, and product shots.
Feeling: The perfect symmetry of the square format creates a sense of balance, stability, and focus. By eliminating distracting peripheral space, it forces the viewer's eye toward the center, creating an intimate and direct connection with the subject. It can feel intentional, orderly, and modern.
Common Uses:
The default for many social media feeds (like Instagram).
Example:
Close-up of a perfectly brewed cup of coffee, top-down view, intricate latte art, soft lighting (1:1 aspect ratio)

2. Full Screen (4:3)
Best For & Emotional Impact:
Scenes: Still life, classic portraiture, documentary-style shots, and scenes that need a bit of environmental context without feeling overwhelmingly wide.
Feeling: This ratio evokes a classic, nostalgic, and traditional feeling, reminiscent of old film photography and pre-widescreen television. It’s a very natural and balanced storytelling frame that feels grounded and familiar, less dramatic than wider or taller formats.
Common Uses:
Multimedia content, older TVs, digital camera sensors.
Examples:
Close-up of a musician's fingers playing the piano, black and white, vintage film (4:3 aspect ratio)
Professional studio photo of fries for a high-end restaurant, gastronomic magazine style (4:3 aspect ratio)

3. Vertical Full Screen (3:4)
Best For & Emotional Impact:
Scenes: Full-body portraits (especially fashion), architecture (skyscrapers, tall monuments), towering natural elements (waterfalls, forests), and powerful character shots.
Feeling: This format emphasizes height and creates a sense of grandeur, scale, and upward momentum. It can make subjects feel imposing, majestic, or powerful. It’s perfect for shots where you want the viewer to look up in awe or to appreciate the full verticality of a subject.
Common Uses:
Captures more of the vertical scene, great for print and some social media.
Examples:
A woman hiking near her boots reflected in a puddle, large mountains in the background, ad style, dramatic angles (3:4 aspect ratio)
Aerial shot of a river flowing through a mystical valley (3:4 aspect ratio)

4. Wide Screen (16:9)
Best For & Emotional Impact:
Scenes: Landscapes, cityscapes, action sequences, group shots, and establishing shots that reveal a location.
Feeling: This is the quintessential cinematic ratio. It creates an expansive, immersive, and dynamic feeling that mimics our natural field of view. It's ideal for conveying a sense of freedom, adventure, and scope, allowing the environment to play a crucial role in the story.
Common Uses:
The standard for modern TVs, computer monitors, and most phone video.
Example:
A man in white clothes sitting on the beach, foreground, golden hour lighting (16:9 aspect ratio)
A futuristic car speeding down a neon-lit highway at night (16:9 aspect ratio)

5. Vertical (9:16)
Best For & Emotional Impact:
Scenes: Single-person content (dancing, talking heads), "point-of-view" shots, and showcasing tall, singular subjects.
Feeling: This ratio feels immediate, personal, and modern, as it's the native format for phone screens. It creates a focused, "in-the-moment" experience that can feel very intimate. While it can feel restrictive for landscapes, it’s incredibly powerful for making a single person or object the undeniable center of attention.
Common Uses:
Dominant in short-format videos (TikTok, Instagram Reels, YouTube Shorts).
Example:
Digital rendering of a huge, modern skyscraper, big and epic with a beautiful sunset (9:16 aspect ratio)
A chef tossing pizza dough in the air, captured from a low angle, flour flying everywhere (9:16 aspect ratio)
---

## Photorealistic Images

Different keywords and lens types can help achieve photorealistic images depending on the subject.

| Use Case | Lens Type | Focal Lengths | Additional Details |
| --- | --- | --- | --- |
| People (portraits) | Prime, Zoom | 24 to 35 mm | Black and white film, noir film, depth of field, dual-tone (mention two colors) |
| Food, insects, plants | Macro | 60 to 105 mm | Controlled lighting, precise focus, great detail |
| Sports and fauna (movement) | Telephoto Lens | 100 to 400 mm | Fast shutter speed, action or motion tracking |
| Astromic, horizontal (wide angle) | Wide angle | 10 to 24 mm | Long exposure times, sharp focus, flowing water or clouds |

### Photorealistic Examples

- **Portraits:**

- *A woman (35mm portraits, dual shades of blue and gray)*
- *A woman, 35 mm portrait, film model*
- **Objects:**

- *Leaf of a prayer plant, macro lens, 60 mm*
- *A pasta plate, 100 mm with macro lens*
- **Movement:**

- *A winning score, fast shutter speed and motion tracking*
- *A deer running in the forest, fast shutter speed, motion tracking*
- **Wide Angle:**

- *An extensive, wide-angle horizontal mountain range of 10 mm*
- *A photo of the moon, astrological photographs, 10 mm wide angle*

---

This guide should empower you to write effective, detailed, and creative prompts for text-to-image generation models, helping you achieve the best possible image outputs.
"""

async def run(config: CONFIG, inputs: INPUTS) -> OUTPUT:
    num_scenes = inputs.num_scenes if inputs.num_scenes is not None else config.num_scenes

    # Step 1: Extract visual style from the initial description (unchanged)
    style_extract_prompt = (
        "Analyze the following story description and extract any style, mood, artistic, or visual instructions "
        "that would be relevant for image generation (such as art style, color palette, atmosphere, visual mood, photography style, "
        "era, genre, medium, or any keywords that would affect the appearance of images). "
        "If there are no such instructions, respond with 'none'.\n\n"
        f"Story description:\n{inputs.story_description}\n"
        "End of story description."
    )
    style_response = await shinkai_llm_prompt_processor({
        "prompt": style_extract_prompt,
        "format": "text"
    })
    style_instruction = style_response.get("message", "").strip()
    if style_instruction.lower() == "none":
        style_instruction = ""

    # Step 2: Generate the base story
    story_gen_prompt = (
        f"The content below are partial descriptions or fragments of a story. "
        f"Story description: '{inputs.story_description}'.\n"
        "End of story description.\n"
        "You are a skilled storyteller and will create a story based on these descriptions. "
        "The story must expand on these descriptions without adding too many unrelated elements. "
        "It must respect the story description: the emotions, sensations, surroundings, feelings, actions, and characters. "
        "Include some actions that the description suggests. "
        "Be imaginative with detailed descriptions and narration, but stay true to the description."
    )
    story_response = await shinkai_llm_prompt_processor({
        "prompt": story_gen_prompt, "format": "text"
    })
    full_story = story_response.get("message", "")

    # Step 3: Use the Placeholder Method to insert placeholders and get scene descriptions
    placeholder_prompt = (
        f"You are a story editor. Your task is to read the following story and perform two actions:\n"
        f"1. Identify the {num_scenes} most visually compelling moments suitable for an illustration.\n"
        f"2. Insert a unique placeholder tag (e.g., '[IMAGE_1]', '[IMAGE_2]', etc.) directly into the story text at the exact spot where the image for that moment should go.\n"
        f"3. For each placeholder, write a detailed scene description for an image generator.\n\n"
        "Your final output MUST be a single JSON object with two keys:\n"
        "- 'story_with_placeholders': The full story text with the placeholder tags inserted.\n"
        "- 'scenes': A list of objects, where each object has a 'placeholder' key (e.g., '[IMAGE_1]') and a 'description' key (the scene description).\n\n"
        f"Story:\n{full_story}\n"
        "End of Story.\n\n"
        "Respond with ONLY the JSON object."
    )
    
    placeholder_response = await shinkai_llm_prompt_processor({
        "prompt": placeholder_prompt, "format": "text"
    })

    # Robust JSON parsing
    scenes_data = {}
    try:
        message_content = placeholder_response.get("message", "{}")
        start_index = message_content.find('{')
        end_index = message_content.rfind('}') + 1
        if start_index != -1 and end_index != 0:
            json_string = message_content[start_index:end_index]
            scenes_data = json.loads(json_string)
    except json.JSONDecodeError:
        scenes_data = {"story_with_placeholders": full_story, "scenes": []}

    story_with_placeholders = scenes_data.get("story_with_placeholders", full_story)
    scenes_to_generate = scenes_data.get("scenes", [])

    # Step 4: Generate images in parallel with a staggered start using wait_1_5_seconds tool
    from shinkai_local_tools import wait_1_5_seconds

    image_generation_tasks = []
    style_text = f"Style or visual instructions: {style_instruction}\n" if style_instruction else ""

    async def generate_image_with_stagger(index: int, prompt: str) -> Dict[str, Any]:
        for _ in range(index):
            await wait_1_5_seconds({})
        return await text_to_image_generator_getimg_ai_flux_1({"prompt": prompt, "output_format": "jpeg"})

    for i, scene in enumerate(scenes_to_generate):
        scene_description = scene.get("description", "")
        # Build the detailed image prompt using the guide
        image_prompt_builder = {
            "prompt": (
                f"{DETAILED_IMAGE_PROMPT_GUIDE}\n\n"
                f"{style_text}"
                "Using the above guide and the image style asked for, build a clear, descriptive, and concise text prompt for image generation "
                "that respects the following image size rules: width and height must be between 256 and 1280 pixels "
                "and must be multiples of 8. "
                "Choose an image ratio the most suited for the scene, its intentions, the feelings, the ambiance, etc.\n\n"
                f"Scene description to base the prompt on:\n{scene_description}\n\n"
                "Generate only the prompt text, suitable to send as prompt to an image generation model. "
                "Do not add any instructions about adding text on the image."
            ),
            "format": "text"
        }
        prompt_build_response = await shinkai_llm_prompt_processor(image_prompt_builder)
        constructed_prompt = prompt_build_response.get("message", "").strip()

        # Staggered task using wait_1_5_seconds for delay
        task = generate_image_with_stagger(i, constructed_prompt)
        image_generation_tasks.append(task)

    # Run all tasks concurrently and collect results
    image_results = []
    if image_generation_tasks:
        image_results = await asyncio.gather(*image_generation_tasks, return_exceptions=True)

    # Step 5: Create a mapping from placeholder to the final markdown
    placeholder_to_markdown = {}
    for i, result in enumerate(image_results):
        placeholder = scenes_to_generate[i].get("placeholder")
        if not placeholder:
            continue

        if isinstance(result, Exception):
            markdown = f"\n\n![Image generation failed for {placeholder}: {str(result)}]\n"
        else:
            img_url = result.get("response_image_generated", "")
            if img_url:
                markdown = f"\n\n![Scene illustration]({img_url})\n"
            else:
                markdown = f"\n\n![Image generation did not return a URL for {placeholder}]\n"
        
        placeholder_to_markdown[placeholder] = markdown

    # Step 6: Replace placeholders in the story
    final_story = story_with_placeholders
    for placeholder, markdown in placeholder_to_markdown.items():
        final_story = final_story.replace(placeholder, markdown)
    
    # Step 7: Assemble the final output
    story_reading_instructions = (
        "You are a storyteller AI. Your task is to present the following illustrated story to the user.\n\n"
        "Instructions:\n"
        "1.  **Reproduce the Story Verbatim:** You must output the story text exactly as it is provided. Do not change, summarize, or paraphrase any part of the narrative.\n"
        "2.  **Render Images:** The story contains image placeholders using Markdown syntax: `![Scene illustration](URL)`. You must interpret this Markdown and display the image from the URL at that exact point in the story.\n"
        "3.  **Continuous Output:** Present the entire story, including all text and embedded images, in a single, flowing response. Do not break it down or present it scene by scene.\n\n"
        "The goal is to provide a seamless reading experience where the illustrations appear naturally within the text. Now, present the story that follows."
    )

    output = OUTPUT()
    output.story = final_story
    output.story_reading_instructions_for_LLM = story_reading_instructions
    if config.show_scene_descriptions:
        output.scene_descriptions = [s.get("description", "") for s in scenes_to_generate]
    if config.show_style_instruction:
        output.style_instruction = style_instruction
      
    return output