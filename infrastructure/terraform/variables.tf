variable "subscription_id" {
  description = "Azure subscription to use for this lab. Authenticate using Azure CLI."
  type        = string
}

variable "location" {
  description = "Azure region. Verify subscription permissions and VM availability before planning."
  type        = string
  default     = "denmarkeast"
}

variable "vm_size" {
  description = "Starting choice from project one; verify availability and cost before applying."
  type        = string
  default     = "Standard_B2als_v2"
}

variable "admin_username" {
  description = "Local Linux administrator account."
  type        = string
  default     = "azureuser"
}

variable "ssh_public_key" {
  description = "Your VM access public key, for example the contents of an id_ed25519.pub file. Never supply a private key."
  type        = string

  validation {
    condition     = can(regex("^(ssh-ed25519|ssh-rsa) [A-Za-z0-9+/=]+", trimspace(var.ssh_public_key)))
    error_message = "Supply an OpenSSH RSA or ED25519 public key, not a private key or file path."
  }
}

variable "allowed_ssh_cidr" {
  description = "Your current public IPv4 address with /32, allowing SSH from that single address."
  type        = string

  validation {
    condition     = can(cidrnetmask(var.allowed_ssh_cidr)) && endswith(var.allowed_ssh_cidr, "/32")
    error_message = "Use a single public IPv4 address with /32, rather than opening SSH to everyone."
  }
}
