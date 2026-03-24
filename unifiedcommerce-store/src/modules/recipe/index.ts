import { Module } from "@medusajs/framework/utils"
import RecipeModuleService from "./service"

export default Module("recipe", {
  service: RecipeModuleService,
})
