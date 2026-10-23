output "private_ip" {
  value       = digitalocean_droplet.web.ipv4_address_private
  description = "What the edge's upstream points at, and what deploy tasks SSH to through the edge."
}

output "droplet_id" {
  value = digitalocean_droplet.web.id
}

output "db_host" {
  value       = data.digitalocean_database_cluster.shared.private_host
  description = "Private (VPC) hostname of the shared cluster: what the droplet connects to."
}

output "db_public_host" {
  value       = data.digitalocean_database_cluster.shared.host
  description = "Public hostname of the shared cluster: what the operator's machine connects to (its IP must be in the hub's admin_cidrs)."
}

output "db_port" {
  value = data.digitalocean_database_cluster.shared.port
}

output "db_name" {
  value = digitalocean_database_db.app.name
}

output "db_app_user" {
  value = digitalocean_database_user.app.name
}

output "db_app_password" {
  value     = digitalocean_database_user.app.password
  sensitive = true
}

output "db_ca_certificate" {
  value       = data.digitalocean_database_ca.shared.certificate
  description = "PEM CA certificate of the cluster (public)."
}
