import { Module } from "@medusajs/framework/utils"
import StoreLocatorModuleService from "./service"

export default Module("storeLocator", {
  service: StoreLocatorModuleService,
})
