import { MedusaService } from "@medusajs/framework/utils"
import { StoreLocation } from "./models"

class StoreLocatorModuleService extends MedusaService({
  StoreLocation,
}) {}

export default StoreLocatorModuleService
