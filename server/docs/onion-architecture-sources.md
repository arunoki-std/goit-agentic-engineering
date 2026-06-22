# Onion Architecture — Sources & Reading List

Reference for the `/onion-architecture` skill. Organized by topic.

---

## Original Theory

- [The Onion Architecture: Part 1 — Jeffrey Palermo (2008)](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/)
  The original post that coined the term. Defines the four tenets: independent object model, inner layers define interfaces, outer layers implement interfaces, dependency direction points inward.

- [Onion Architecture: Part 4 — After Four Years — Jeffrey Palermo](http://jeffreypalermo.com/blog/onion-architecture-part-4-after-four-years/)
  Palermo revisits the concept, common misunderstandings, and how it holds up in practice.

- [DDD, Hexagonal, Onion, Clean, CQRS — How I Put It All Together — Herberto Graça](https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together/)
  The definitive synthesis article. Maps all major architecture patterns onto a single diagram and explains how they complement each other.

- [Onion Architecture — The Software Architecture Chronicles (Medium)](https://medium.com/the-software-architecture-chronicles/onion-architecture-79529d127f85)
  Herberto Graça's condensed treatment of Onion Architecture in the broader context of architectural evolution.

---

## Node.js / TypeScript Practical

- [Implementing SOLID and the Onion Architecture in Node.js with TypeScript and InversifyJS — DEV Community](https://dev.to/remojansen/implementing-the-onion-architecture-in-nodejs-with-typescript-and-inversifyjs-10ad)
  Step-by-step implementation with InversifyJS for DI. Good reference for how interfaces map to TypeScript and how the container wires layers.

- [Clean Node.js Architecture — Khalil Stemmler](https://khalilstemmler.com/articles/enterprise-typescript-nodejs/clean-nodejs-architecture/)
  Stemmler's enterprise TypeScript series. Covers repository pattern, use cases, and domain modeling for Node.js without a specific framework.

- [Onion Architecture in Node.js with TypeScript — Sankhadip Samanta (Medium)](https://sankhadip.medium.com/onion-architecture-in-node-js-with-typescript-5508612a4391)
  Practical walkthrough building a Node.js API structured as concentric layers with TypeScript interfaces.

- [Clean Architecture with TypeScript: DDD, Onion — André Bazaglia](https://bazaglia.com/clean-architecture-with-typescript-ddd-onion/)
  Combines DDD tactical patterns (aggregates, repositories, domain services) with Onion layer organization in TypeScript.

- [Fastify Clean Architecture boilerplate — GitHub (revell29)](https://github.com/revell29/fastify-clean-architecture)
  A working Fastify + TypeScript project that implements DDD + Clean Architecture principles. Closest to this project's stack.

---

## Comparisons & Decision Guides

- [Hexagonal vs Clean vs Onion Architectures — Programming Pulse](https://programmingpulse.vercel.app/blog/hexagonal-vs-clean-vs-onion-architectures)
  Side-by-side comparison of all three patterns: when each is the right choice, key differences, and shared principles.

- [Clean Architecture vs. Onion Architecture vs. Hexagonal Architecture — CCD Akademie](https://ccd-akademie.de/en/clean-architecture-vs-onion-architecture-vs-hexagonal-architecture/)
  Visual diagrams and a decision table. Good quick reference for explaining differences to teammates.

- [Onion Architecture: Going Beyond Layers — NDepend Blog](https://blog.ndepend.com/onion-architecture-layers/)
  Explains why naive layered architecture fails (dependencies point the wrong way) and how Onion fixes it.

- [Layered vs Clean vs Onion vs Hexagonal — Practical Guide (Medium)](https://medium.com/@rup.singh88/stop-confusing-clean-onion-hexagonal-architecture-heres-when-to-use-each-692079e56267)
  Pragmatic guide for choosing between architectural styles based on project size and lifecycle.

---

## Advanced / Adjacent

- [Sliced Onion Architecture — Oliver Drotbohm](http://odrotbohm.github.io/2023/07/sliced-onion-architecture/)
  Describes exactly what this project does: vertical slices by feature, with Onion rings *within* each slice rather than across the codebase. The "why" behind our `modules/<name>/` structure.

- [Onion Architecture — blog.allegro.tech](https://blog.allegro.tech/2023/02/onion-architecture.html)
  Production engineering team's writeup on adopting Onion Architecture. Covers practical pitfalls and team coordination patterns.

- [Ports and Adapters (Hexagonal Architecture) Explained with Two Real Codebases — Saad Hasan](https://saadh393.github.io/blog/adapter-port-architecture-two-cases)
  Concrete walkthrough of Ports & Adapters pattern with real codebase examples. Useful for understanding how `vendor/shared/adapters.ts` interfaces map to the pattern.
