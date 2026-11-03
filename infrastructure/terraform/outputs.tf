output "resource_group_name" {
  description = "Resource group dedicated to the second project."
  value       = azurerm_resource_group.lab.name
}

output "vm_public_ip" {
  description = "Public address used for SSH. Web ports are not opened."
  value       = azurerm_public_ip.vm.ip_address
}

output "vm_private_ip" {
  description = "VM address inside the app subnet."
  value       = azurerm_network_interface.vm.private_ip_address
}
