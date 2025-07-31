# Detailed Guide on Prompting for Image Generation

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
  
  ```
  A {logo_style} logo for a {company_area} company on a solid color background. Include the text {company_name}.
  ```
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
   
   - *Photo of a sheet, macro lens*
   - *Street photography, New York City, fisheye lens*

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

### Aspect Ratios

Here are five different aspect ratios commonly used:

1. **Square (1:1, default)**
   
   - Used for social media posts.

2. **Full screen (4:3)**
   
   - Used in multimedia content or older TVs.
   - Examples:
     - *Close-up of a musician's fingers playing the piano, black and white, vintage film (4:3 aspect ratio)*
     - *Professional studio photo of fries for a high-end restaurant, gastronomic magazine style (4:3 aspect ratio)*

3. **Vertical full screen (3:4)**
   
   - Captures more vertical scene.
   - Examples:
     - *A woman hiking near her boots reflected in a puddle, large mountains in the background, ad style, dramatic angles (3:4 aspect ratio)*
     - *Aerial shot of a river flowing through a mystical valley (3:4 aspect ratio)*

4. **Wide screen (16:9)**
   
   - Common for TVs, monitors, phones.
   - Example:
     - *A man in white clothes sitting on the beach, foreground, golden hour lighting (16:9 aspect ratio)*

5. **Vertical (9:16)**
   
   - Popular for short-format videos.
   - Example:
     - *Digital rendering of a huge, modern skyscraper, big and epic with a beautiful sunset (9:16 aspect ratio)*

---

## Photorealistic Images

Different keywords and lens types can help achieve photorealistic images depending on the subject.

| Use Case                          | Lens Type      | Focal Lengths | Additional Details                                                              |
| --------------------------------- | -------------- | ------------- | ------------------------------------------------------------------------------- |
| People (portraits)                | Prime, Zoom    | 24 to 35 mm   | Black and white film, noir film, depth of field, dual-tone (mention two colors) |
| Food, insects, plants             | Macro          | 60 to 105 mm  | Controlled lighting, precise focus, great detail                                |
| Sports and fauna (movement)       | Telephoto Lens | 100 to 400 mm | Fast shutter speed, action or motion tracking                                   |
| Astromic, horizontal (wide angle) | Wide angle     | 10 to 24 mm   | Long exposure times, sharp focus, flowing water or clouds                       |

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

If you need help generating sample images or further examples, feel free to ask!