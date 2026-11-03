# Project two: UniPath infrastructure with Terraform

Terraform provisions one Ubuntu VM in a separate Azure lab resource group. See the [project write-up](../../docs/TERRAFORM-AZURE-LAB.md) for the exercises, results and deployment notes.

The network contains one VNet and one app subnet. Its security group permits SSH from a single public IPv4 address. Use an SSH tunnel to reach UniPath on the VM's loopback port.

| File                       | Purpose                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| `providers.tf`             | Terraform and AzureRM version requirements and subscription selection     |
| `main.tf`                  | The nine infrastructure resources and their dependencies                  |
| `variables.tf`             | Region, VM size, public SSH key, allowed source IP and other inputs       |
| `outputs.tf`               | Lab resource group and VM addresses                                       |
| `backend.tf`               | Azure Blob Storage state backend using Entra ID and the Azure CLI session |
| `terraform.tfvars.example` | Example inputs for a local, ignored `terraform.tfvars`                    |

For a separate deployment, create a private state container in a different resource group, configure its data access, and update the backend coordinates for your own account and state key. Sign in with Azure CLI, confirm your subscription, and check regional availability and budget before applying.

```sh
terraform init
terraform fmt -check
terraform validate
terraform plan
```

Review the plan before applying. If rebuilding an existing lab, make and verify an off-VM database backup before destroying resources. The VM image currently follows the latest Ubuntu 24.04 image. Pin an exact image version if identical image rebuilds are required.
