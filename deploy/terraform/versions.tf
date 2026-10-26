terraform {
  required_version = "~> 1.15"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.106"
    }
  }

  # State lives in a shared Spaces bucket managed outside this repo. Its name is not committed: it comes from
  # TF_STATE_BUCKET in .secure.deploy.env, passed as `-backend-config=bucket=...` by deploy/scripts (tf_init).
  # Credentials come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (.secure.deploy.env), a Spaces key scoped to it.
  # No locking: Spaces ignores the conditional writes `use_lockfile` relies on,
  # so don't run two applies against the same state at once.
  backend "s3" {
    endpoints                   = { s3 = "https://fra1.digitaloceanspaces.com" }
    key                         = "bag-please/web.tfstate"
    region                      = "us-east-1"
    skip_credentials_validation = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_s3_checksum            = true
  }
}
