# WebScraper API stack

HTTP API (ApiGatewayV2) created from the OpenAPI spec in the docs bucket.

## Custom domain (api.webscraper.ropegeo.com)

The template supports an optional custom domain. You need:

1. **ACM certificate** for `api.webscraper.ropegeo.com` in the **same region** as the API (e.g. `us-east-1`). Request or import it in [AWS Certificate Manager](https://console.aws.amazon.com/acm/).

2. **Deploy (or update) the stack** with the domain and certificate:
   ```bash
   aws cloudformation deploy \
     --template-file cloudformation/stacks/api/template-resolved.yaml \
     --stack-name WebScraper-Api-Prod \
     --parameter-overrides \
       DocsBucketName=YOUR_DOCS_BUCKET \
       CustomDomainName=api.webscraper.ropegeo.com \
       ApiCertificateArn=arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT_ID \
     --capabilities CAPABILITY_IAM \
     --region us-east-1
   ```

3. **DNS**: After the stack succeeds, use the output **WebScraperApiRegionalDomainName** (e.g. `d-xxxxxxxxxx.execute-api.us-east-1.amazonaws.com`).
   - **Option A (CNAME)**: Create a CNAME record: `api.webscraper.ropegeo.com` → value of `WebScraperApiRegionalDomainName`.
   - **Option B (Route 53 alias)**: If the hosted zone for `ropegeo.com` is in Route 53, create an A (or AAAA) record alias: `api.webscraper.ropegeo.com` → API Gateway domain name target, using **WebScraperApiRegionalHostedZoneId** as the target hosted zone.

4. Wait for DNS to propagate, then use `https://api.webscraper.ropegeo.com` as the API base URL.

To skip the custom domain, omit `CustomDomainName` and `ApiCertificateArn` (or leave them blank). The default execute-api URL will still work.
