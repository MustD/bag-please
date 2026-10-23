output "private_ip" {
  value       = digitalocean_droplet.web.ipv4_address_private
  description = "What the edge's upstream points at, and what deploy tasks SSH to through the edge."
}

output "droplet_id" {
  value = digitalocean_droplet.web.id
}

output "db_host" {
  value       = digitalocean_database_cluster.pg.private_host
  description = "Private (VPC) hostname of the cluster."
}

output "db_port" {
  value = digitalocean_database_cluster.pg.port
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

output "db_admin_user" {
  value = digitalocean_database_cluster.pg.user
}

output "db_admin_password" {
  value     = digitalocean_database_cluster.pg.password
  sensitive = true
}

output "db_ca_certificate" {
  value       = data.digitalocean_database_ca.pg.certificate
  description = "PEM CA certificate of the cluster (public)."
}
