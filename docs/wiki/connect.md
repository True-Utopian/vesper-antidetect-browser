# Connect to the local API

Browser 0.4.10 / Workbench 0.5.15. By **true-utopian**.

Discover the service and keep authentication private.

## Use the running address

The address shown in Overview belongs to this running instance. Desktop services choose available loopback ports; do not assume a development port. Keep the application running while your client is connected. After restart, discover the new address from the private service.json in that product’s data directory, then verify authenticated /api/v1/capabilities before using it.

## Two services, two tokens

Browser owns profiles. Workbench owns automation and schedules. Each product keeps its own admin-token in its private data directory. CLI users can retrieve the appropriate token with vesper-browser token or vesper-workbench token. The desktop supplies tokens privately to its own views. An external browser opened on documentation receives no token. Set VESPER_TOKEN privately in your script environment; do not paste credentials into URLs, screenshots, source control or shared examples.

## Check your connection

The following read-only example prints this instance’s product, application version and API capabilities. Replace the token placeholder locally. Browser and Workbench expose the same versioned discovery path.

```text
curl --header "Authorization: Bearer <your-token>" $ORIGIN/api/v1/capabilities
```

## What this reference contains

The endpoint list comes from the bundled OpenAPI contract. Request fields and any declared response schemas are shown alongside each operation. Some operations declare generic responses; the reference labels these limits rather than inventing a schema. Examples are templates and never run automatically. Versioned API paths are preferred; legacy /api aliases remain available. Documentation is public, read-only contract material on the same local service; API operations retain authentication and origin checks.

[Wiki contents](README.md) · [Report a correction](https://github.com/True-Utopian/vesper-workbench/issues)
