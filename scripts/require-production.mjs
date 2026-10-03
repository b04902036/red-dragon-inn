if (process.env.CLOUDFLARE_ENV) {
  throw new Error(
    'Production deployment requires the default environment. Clear CLOUDFLARE_ENV; fixture deployment is not allowed by npm run deploy.',
  );
}
