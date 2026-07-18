# Contributing to MIYO-STREAM

First off, thank you for considering contributing to MIYO-STREAM! It's people like you that make open-source projects great.

## Where do I go from here?

If you've noticed a bug or have a feature request, make sure to check our [Issues](../../issues) to see if someone has already reported it or requested it. If not, feel free to open a new issue!

## Fork & create a branch

If this is something you think you can fix, then [fork MIYO-STREAM](https://help.github.com/articles/fork-a-repo) and create a branch with a descriptive name.

A good branch name would be (where issue #325 is the ticket you're working on):

```sh
git checkout -b 325-add-new-search-filter
```

## Local Development

1. Clone your fork locally.
2. Install dependencies: `npm install`.
3. Set up your `.env` file from `.env.example`.
4. Run the development server using `npm run dev` or `vercel dev`.

## Code Style

- We use standard ES6+ Javascript/JSX syntax.
- Styling is handled via Tailwind CSS utility classes.
- Ensure any new UI components match the existing design language (e.g., using the `ACCENT_COLOR` defined in `constants.js`).
- Please make sure there are no linting errors and format your code nicely before submitting.

## API & Backend Changes

If you're making changes to the serverless functions located in the `/api` directory:
- Remember that we heavily rely on caching via `@vercel/blob`.
- Ensure changes do not break the caching logic to prevent rate-limiting from our upstream providers (TMDB and AniList).
- Test backend changes using `vercel dev` to simulate the production environment.

## Pull Requests

1. Make sure your code is clean and well-commented.
2. Ensure any new dependencies added are absolutely necessary.
3. Once you're ready, submit a Pull Request to the `main` branch of the original repository.
4. Describe your changes thoroughly in the PR description, referencing any related issue numbers.

## Need Help?

If you need any help, feel free to ask questions in the issues or on your Pull Request. We are happy to help you get your contribution over the finish line!
