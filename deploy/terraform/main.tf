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

# Managed PostgreSQL: one node, cheapest tier, inside the VPC. Reachable only through the private network from
# the droplet (see the database firewall below); operators reach it through an SSH tunnel over the droplet.
resource "digitalocean_database_cluster" "pg" {
  name                 = "bag-please-pg"
  engine               = "pg"
  version              = "18"
  size                 = var.db_size
  region               = var.region
  node_count           = 1
  private_network_uuid = data.digitalocean_vpc.edge.id
}

resource "digitalocean_database_db" "app" {
  cluster_id = digitalocean_database_cluster.pg.id
  name       = "bag_please"
}

resource "digitalocean_database_user" "app" {
  cluster_id = digitalocean_database_cluster.pg.id
  name       = "bag_please_app"
}

# Exactly one rule: the droplet. Nothing else, the public internet included, can open a connection.
resource "digitalocean_database_firewall" "pg" {
  cluster_id = digitalocean_database_cluster.pg.id

  rule {
    type  = "droplet"
    value = digitalocean_droplet.web.id
  }
}

# The cluster's CA, for `verify-ca` (importer tunnel) and `verify-full` (runtime) connections.
data "digitalocean_database_ca" "pg" {
  cluster_id = digitalocean_database_cluster.pg.id
}
