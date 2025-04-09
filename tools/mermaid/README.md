# Mermaid Diagram Generator

## Name & Description
A tool that generates diagrams and flowcharts using Mermaid syntax. It takes a natural language description and returns a PNG image of the diagram along with the final Mermaid code used to generate it.

## Parameters/Inputs
The tool accepts the following parameter:
- `description` (string, required): A natural language description of the diagram or flowchart to be generated.

## Config
The tool allows for an optional configuration:
- `maxRetries` (number, optional, default: 5): Specifies the maximum number of times the tool should attempt to ask the LLM to fix the Mermaid code if the initial rendering fails.

## Output
The tool returns an object with the following fields:
- `pngBase64` (string, required): A base64 encoded string representing the generated PNG image of the diagram.
- `finalMermaid` (string, required): The final, validated Mermaid code that successfully rendered the diagram.
