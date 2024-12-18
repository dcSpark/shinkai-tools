# Hello World 2

A simple function that takes a number as input and returns that number plus one.

## Description

This tool provides a basic function that takes a number input and returns that number incremented by one. It serves as a simple example of numeric input/output processing.

## Input Parameters

The function requires the following input parameter:

```typescript
{
    number: number  // The input number to be incremented
}
```

## Output

The function returns an object with the following structure:

```typescript
{
    result: number  // The input number plus one
}
```

## Example Usage

```typescript
const result = await run({}, { number: 5 });
console.log(result.result); // Outputs: 6
```
