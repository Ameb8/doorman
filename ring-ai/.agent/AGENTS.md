## Coding Standards

### Strict Mode Enabled

### Avoid using `any` (use `unknown` Instead)

### Leverage Discriminated Unions

When dealing with objects that can have different states (like an API response that can be a success or a failure), don't make all fields optional. Instead, use a single, shared property (the "discriminant") to let TypeScript safely determine the exact shape.

```ts
interface SuccessState {
  status: "success"; // Discriminant
  data: string[];
}

interface ErrorState {
  status: "error";   // Discriminant
  message: string;
}

type AppState = SuccessState | ErrorState;

function handleState(state: AppState) {
  if (state.status === "success") {
    // TypeScript instantly knows state.data exists, but state.message does not
    console.log("Loaded items:", state.data.length);
  } else {
    // TypeScript knows state.message exists here
    console.error("Failed:", state.message);
  }
}
```

### Let TypeScript Infer Types (Don't Over-Type)

Don't  explicitly declare a type for every single variable. TypeScript is incredibly smart at figuring out types on its own (type inference). 

### Use type vs. interface Intentionally

While they are highly interchangeable in modern TypeScript, the community has generally gravitated toward a simple rule:

#### When to Use

- *interface*: Ideal for defining the structural shape of objects, classes, or public APIs. They support declaration merging (appending properties later).
- *type*: Ideal for unions, primitives, tuples, intersections, or complex mapped types.
TypeScript

```ts
// Use interfaces for object models
interface User {
  id: string;
  name: string;
}

// Use types for unions or aliases
type HandshakeResult = "success" | "retry" | "fail";
```