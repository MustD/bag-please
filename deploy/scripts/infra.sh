#!/usr/bin/env bash
# infra.sh plan|apply - Terraform with .secure.deploy.env's DIGITALOCEAN_TOKEN, TF_VAR_* and the Spaces key for the S3
# backend. Applied by hand, never by a deploy.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
case "${1:-}" in plan | apply) ;; *) echo "usage: infra.sh plan|apply" >&2; exit 2 ;; esac
require_env DIGITALOCEAN_TOKEN AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY TF_VAR_edge_private_ip TF_VAR_vpc_name TF_VAR_ssh_key_name \
	TF_VAR_pg_cluster_name TF_VAR_pg_client_tag
# Terraform needs the token and TF_VAR_*, never the cluster admin's credentials (db:bootstrap's alone).
unset PG_ADMIN_USER PG_ADMIN_PASSWORD
cd deploy/terraform || exit 1
terraform init -input=false
exec terraform "$1"
