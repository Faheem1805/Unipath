terraform {
  backend "azurerm" {
    resource_group_name  = "rg-unipath-tfstate"
    storage_account_name = "unipathstate09b85b25"
    container_name       = "tfstate"
    key                  = "unipath-dev.tfstate"
    use_azuread_auth     = true
    use_cli              = true
  }
}
