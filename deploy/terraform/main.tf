provider "digitalocean" {}

data "digitalocean_vpc" "edge" {
  name = var.vpc_name
}

# An existing account key, looked up rather than created: DigitalOcean refuses a second key
# with the same fingerprint, so a resource for a key already in the account fails the apply.
data "digitalocean_ssh_key" "deploy" {
  name = var.ssh_key_name
}

resource "digitalocean_droplet" "web" {
  name     = "bag-please-web"
  region   = var.region
  size     = var.size
  image    = var.image
  vpc_uuid = data.digitalocean_vpc.edge.id
  ssh_keys = [data.digitalocean_ssh_key.deploy.id]
  # The cluster's database firewall trusts every droplet carrying this tag; that is the droplet's only way in.
  tags = [var.pg_client_tag]

  user_data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
    ssh_public_key = trimspace(data.digitalocean_ssh_key.deploy.public_key)
  })

  lifecycle {
    # The edge proxies to this droplet's private IP, so a replacement moves the upstream.
    # A cloud-init or image edit must not silently destroy and recreate it; replacing the
    # droplet is a deliberate act (`terraform apply -replace=...`) followed by updating the edge.
    ignore_changes = [user_data, image]
  }
}

resource "digitalocean_firewall" "web" {
  name        = "bag-please-web"
  droplet_ids = [digitalocean_droplet.web.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["${var.edge_private_ip}/32"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["${var.edge_private_ip}/32"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

# The PostgreSQL cluster is shared and managed outside this repo: looked up by name, never created here, and its
# firewall (digitalocean_database_firewall) is never managed from here - that would overwrite its owner's rules.
# This stack owns only this app's database and user.
data "digitalocean_database_cluster" "shared" {
  name = var.pg_cluster_name
}

resource "digitalocean_database_db" "app" {
  cluster_id = data.digitalocean_database_cluster.shared.id
  name       = "bag_please"

  lifecycle {
    # Destroying the database drops every list, item and account.
    prevent_destroy = true
  }
}

resource "digitalocean_database_user" "app" {
  cluster_id = data.digitalocean_database_cluster.shared.id
  name       = "bag_please_app"

  lifecycle {
    # The user owns every Flyway-created table and its password is the runtime's; replacing it means re-running the
    # database grants (deploy/README.md) and redeploying the credentials.
    prevent_destroy = true
  }
}

# The cluster's CA, for the `verify-full` connections (runtime and importer).
data "digitalocean_database_ca" "shared" {
  cluster_id = data.digitalocean_database_cluster.shared.id
}
