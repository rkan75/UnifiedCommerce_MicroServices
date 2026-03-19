import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Button,
  Input,
  Label,
  Table,
  Badge,
  toast,
  Drawer,
  Prompt,
  Select,
  Textarea,
} from "@medusajs/ui"
import { DocumentText, PencilSquare, Trash, Plus } from "@medusajs/icons"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback, useEffect, useMemo } from "react"

const getBackendUrl = () => {
  if (typeof window === "undefined") return ""
  return window.location.origin
}

function getErrorMessage(res: Response, errBody: unknown): string {
  if (errBody && typeof errBody === "object") {
    const m = (errBody as { message?: string }).message
    if (typeof m === "string" && m.trim()) return m
    const e = (errBody as { error?: string }).error
    if (typeof e === "string" && e.trim()) return e
  }
  return res.statusText || "Request failed"
}

const api = {
  async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${getBackendUrl()}${path}`, {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options?.headers },
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      throw new Error(getErrorMessage(res, errBody))
    }
    return res.json()
  },
  recipes: {
    list: () => api.fetch<{ recipes: AdminRecipe[] }>("/admin/recipes"),
    get: (id: string) =>
      api.fetch<{ recipe: AdminRecipeDetail }>(`/admin/recipes/${id}`),
    create: (body: RecipePayload) =>
      api.fetch<{ recipe: { id: string } }>("/admin/recipes", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: string, body: RecipePayload) =>
      api.fetch<{ recipe: unknown }>(`/admin/recipes/${id}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      api.fetch<{ deleted: boolean }>(`/admin/recipes/${id}`, {
        method: "DELETE",
      }),
  },
  productVariants: {
    list: async () => {
      const res = await api.fetch<{
        variants: { id: string; title: string; product?: { title: string } }[]
      }>("/admin/product-variants?limit=500")
      return res.variants ?? []
    },
  },
}

type AdminRecipe = {
  id: string
  title: string
  description: string | null
  status: string
  servings: number | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
}

type AdminRecipeDetail = AdminRecipe & {
  image_url: string | null
  steps: Array<{ id: string; step_number: number; instruction: string }>
  ingredients: Array<{
    id: string
    product_variant_id: string
    quantity: number
    unit: string | null
    label: string | null
    display_order: number
  }>
}

type RecipeIngredientPayload = {
  product_variant_id: string
  quantity: number
  unit?: string | null
  label?: string | null
  display_order: number
}

type RecipePayload = {
  title: string
  description?: string | null
  image_url?: string | null
  servings?: number | null
  prep_time_minutes?: number | null
  cook_time_minutes?: number | null
  status?: string
  steps?: Array<{ step_number: number; instruction: string }>
  ingredients?: RecipeIngredientPayload[]
}

const emptyPayload = (): RecipePayload => ({
  title: "",
  description: null,
  image_url: null,
  servings: null,
  prep_time_minutes: null,
  cook_time_minutes: null,
  status: "draft",
  steps: [],
  ingredients: [],
})

const RecipeManagementPage = () => {
  const queryClient = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteRecipe, setDeleteRecipe] = useState<AdminRecipe | null>(null)
  const [form, setForm] = useState<RecipePayload>(emptyPayload())
  const [variantSearchQuery, setVariantSearchQuery] = useState("")

  const { data: recipesData, isLoading, error: recipesError } = useQuery({
    queryKey: ["admin", "recipes"],
    queryFn: () => api.recipes.list(),
  })

  const { data: variants = [], error: variantsError } = useQuery({
    queryKey: ["admin", "product-variants"],
    queryFn: () => api.productVariants.list(),
  })

  const filteredVariants = useMemo(() => {
    const q = (variantSearchQuery ?? "").trim().toLowerCase()
    const selectedIds = new Set(
      (form.ingredients ?? []).map((i) => i.product_variant_id).filter(Boolean)
    )
    if (!q) return variants
    return variants.filter((v) => {
      if (selectedIds.has(v.id)) return true
      const productTitle = (v as { product?: { title?: string } }).product?.title ?? ""
      const variantTitle = v.title ?? ""
      return (
        productTitle.toLowerCase().includes(q) ||
        variantTitle.toLowerCase().includes(q)
      )
    })
  }, [variants, variantSearchQuery, form.ingredients])

  useEffect(() => {
    if (recipesError) {
      toast.error(recipesError instanceof Error ? recipesError.message : "Failed to load recipes")
    }
  }, [recipesError])

  useEffect(() => {
    if (variantsError) {
      toast.error("Failed to load product variants for ingredients")
    }
  }, [variantsError])

  const createMutation = useMutation({
    mutationFn: (body: RecipePayload) => api.recipes.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "recipes"] })
      setDrawerOpen(false)
      setForm(emptyPayload())
      setEditingId(null)
      toast.success("Recipe created")
    },
    onError: (e: Error) =>
      toast.error(e?.message?.trim() ? e.message : "Failed to create recipe."),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: RecipePayload }) =>
      api.recipes.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "recipes"] })
      setDrawerOpen(false)
      setForm(emptyPayload())
      setEditingId(null)
      toast.success("Recipe updated")
    },
    onError: (e: Error) =>
      toast.error(e?.message?.trim() ? e.message : "Failed to update recipe."),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.recipes.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "recipes"] })
      setDeleteRecipe(null)
      toast.success("Recipe deleted")
    },
    onError: (e: Error) =>
      toast.error(e?.message?.trim() ? e.message : "Failed to delete recipe."),
  })

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["admin", "recipes", editingId],
    queryFn: () => api.recipes.get(editingId!),
    enabled: !!editingId && drawerOpen,
  })

  const openCreate = useCallback(() => {
    setEditingId(null)
    setForm(emptyPayload())
    setVariantSearchQuery("")
    setDrawerOpen(true)
  }, [])

  const openEdit = useCallback((recipe: AdminRecipe) => {
    setEditingId(recipe.id)
    setForm(emptyPayload())
    setVariantSearchQuery("")
    setDrawerOpen(true)
  }, [])

  useEffect(() => {
    if (editingId && detailData?.recipe && drawerOpen) {
      const r = detailData.recipe
      setForm({
        title: r.title,
        description: r.description ?? null,
        image_url: r.image_url ?? null,
        servings: r.servings ?? null,
        prep_time_minutes: r.prep_time_minutes ?? null,
        cook_time_minutes: r.cook_time_minutes ?? null,
        status: r.status ?? "draft",
        steps: (r.steps ?? [])
          .sort((a, b) => a.step_number - b.step_number)
          .map((s) => ({ step_number: s.step_number, instruction: s.instruction })),
        ingredients: (r.ingredients ?? [])
          .sort((a, b) => a.display_order - b.display_order)
          .map((i) => ({
            product_variant_id: i.product_variant_id,
            quantity: i.quantity,
            unit: i.unit ?? null,
            label: i.label ?? null,
            display_order: i.display_order,
          })),
      })
    }
  }, [editingId, detailData, drawerOpen])

  const handleSubmit = useCallback(() => {
    if (!form.title.trim()) {
      toast.error("Title is required")
      return
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, body: form })
    } else {
      createMutation.mutate(form)
    }
  }, [form, editingId, updateMutation, createMutation])

  const addStep = useCallback(() => {
    setForm((f) => ({
      ...f,
      steps: [...(f.steps ?? []), { step_number: (f.steps?.length ?? 0) + 1, instruction: "" }],
    }))
  }, [])

  const updateStep = useCallback((index: number, field: "step_number" | "instruction", value: number | string) => {
    setForm((f) => {
      const steps = [...(f.steps ?? [])]
      if (!steps[index]) return f
      steps[index] = { ...steps[index], [field]: value }
      return { ...f, steps }
    })
  }, [])

  const removeStep = useCallback((index: number) => {
    setForm((f) => ({
      ...f,
      steps: (f.steps ?? []).filter((_, i) => i !== index),
    }))
  }, [])

  const addIngredient = useCallback(() => {
    setForm((f) => ({
      ...f,
      ingredients: [
        ...(f.ingredients ?? []),
        { product_variant_id: "", quantity: 1, unit: null, label: null, display_order: f.ingredients?.length ?? 0 },
      ],
    }))
  }, [])

  const updateIngredient = useCallback(
    (
      index: number,
      field: keyof RecipeIngredientPayload,
      value: string | number | null
    ) => {
      setForm((f) => {
        const ingredients = [...(f.ingredients ?? [])]
        if (!ingredients[index]) return f
        ingredients[index] = { ...ingredients[index], [field]: value }
        return { ...f, ingredients }
      })
    },
    []
  )

  const removeIngredient = useCallback((index: number) => {
    setForm((f) => ({
      ...f,
      ingredients: (f.ingredients ?? []).filter((_, i) => i !== index),
    }))
  }, [])

  const recipes = recipesData?.recipes ?? []
  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Recipe Management</Heading>
        <Button onClick={openCreate}>
          <Plus /> Add Recipe
        </Button>
      </div>

      <div className="px-6 py-4">
        {recipesError && (
          <p className="text-ui-fg-error text-sm mb-2">
            {recipesError instanceof Error ? recipesError.message : "Failed to load recipes"}
          </p>
        )}
        {isLoading ? (
          <p className="text-ui-fg-subtle">Loading recipes…</p>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Title</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Servings</Table.HeaderCell>
                <Table.HeaderCell>Time</Table.HeaderCell>
                <Table.HeaderCell className="w-[120px]">Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {recipes.map((r) => (
                <Table.Row key={r.id}>
                  <Table.Cell>
                    <span className="font-medium">{r.title}</span>
                    {r.description && (
                      <span className="text-ui-fg-subtle block text-sm truncate max-w-md">
                        {r.description}
                      </span>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={r.status === "published" ? "green" : "grey"} size="small">
                      {r.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>{r.servings ?? "—"}</Table.Cell>
                  <Table.Cell>
                    {[r.prep_time_minutes, r.cook_time_minutes].filter(Boolean).length
                      ? `Prep ${r.prep_time_minutes ?? 0}m / Cook ${r.cook_time_minutes ?? 0}m`
                      : "—"}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-1">
                      <Button size="small" variant="transparent" onClick={() => openEdit(r)}>
                        <PencilSquare />
                      </Button>
                      <Button
                        size="small"
                        variant="transparent"
                        onClick={() => setDeleteRecipe(r)}
                      >
                        <Trash />
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
        {!isLoading && recipes.length === 0 && (
          <p className="text-ui-fg-subtle">No recipes yet. Add one above.</p>
        )}
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Content className="max-w-[90vw] sm:max-w-6xl">
          <Drawer.Header>
            <Heading level="h2">{editingId ? "Edit Recipe" : "Add Recipe"}</Heading>
          </Drawer.Header>
          <div className="px-6 pb-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            {editingId && detailLoading && <p className="text-ui-fg-subtle">Loading recipe…</p>}
            {(!editingId || detailData?.recipe) && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-6">
                {/* Left: main content and items */}
                <div className="flex flex-col gap-4 min-w-0">
                  <div className="flex flex-col gap-2">
                    <Label>Title *</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Recipe title"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Description</Label>
                    <Textarea
                      value={form.description ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, description: e.target.value || null }))
                      }
                      placeholder="Short description"
                      rows={2}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Image URL</Label>
                    <Input
                      value={form.image_url ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, image_url: e.target.value || null }))
                      }
                      placeholder="https://..."
                    />
                  </div>

                  <Heading level="h3" className="mt-2">
                    Steps
                  </Heading>
                {(form.steps ?? []).map((step, idx) => (
                  <div key={idx} className="flex gap-2 items-start border border-ui-border-base p-2 rounded">
                    <Input
                      type="number"
                      min={1}
                      className="w-16"
                      value={step.step_number}
                      onChange={(e) =>
                        updateStep(idx, "step_number", parseInt(e.target.value, 10) || 1)
                      }
                    />
                    <Input
                      className="flex-1"
                      value={step.instruction}
                      onChange={(e) => updateStep(idx, "instruction", e.target.value)}
                      placeholder="Instruction"
                    />
                    <Button
                      size="small"
                      variant="transparent"
                      onClick={() => removeStep(idx)}
                    >
                      <Trash />
                    </Button>
                  </div>
                ))}
                <Button size="small" variant="secondary" onClick={addStep}>
                  <Plus /> Add Step
                </Button>

                  <Heading level="h3" className="mt-4">
                    Ingredients (product association)
                  </Heading>
                  <div className="flex flex-col gap-2">
                    <Label className="text-ui-fg-subtle text-sm">
                      Search items by name to filter the list below
                    </Label>
                    <Input
                      placeholder="Search by product or variant name…"
                      value={variantSearchQuery}
                      onChange={(e) => setVariantSearchQuery(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                  {(form.ingredients ?? []).map((ing, idx) => {
                    const selectedVariant = ing.product_variant_id
                      ? filteredVariants.find((v) => v.id === ing.product_variant_id)
                      : null
                    const selectedLabel = selectedVariant
                      ? `${(selectedVariant as { product?: { title: string } }).product?.title ?? selectedVariant.title} – ${selectedVariant.title}`
                      : null
                    return (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-center border border-ui-border-base p-2 rounded min-w-0"
                    >
                      <div className="col-span-5 min-w-0 flex-1">
                        <Select
                          value={ing.product_variant_id}
                          onValueChange={(v) =>
                            updateIngredient(idx, "product_variant_id", v)
                          }
                        >
                          <Select.Trigger className="w-full min-w-0 truncate" title={selectedLabel ?? undefined}>
                            <Select.Value placeholder="Select product variant" />
                          </Select.Trigger>
                          <Select.Content className="min-w-[320px] max-w-[min(480px,90vw)]">
                            {filteredVariants.length === 0 ? (
                              <div className="px-2 py-2 text-ui-fg-muted text-sm">
                                {variantSearchQuery.trim()
                                  ? "No items match your search."
                                  : "No variants loaded."}
                              </div>
                            ) : (
                              filteredVariants.map((v) => {
                                const itemLabel = `${(v as { product?: { title: string } }).product?.title ?? v.title} – ${v.title}`
                                return (
                                  <Select.Item key={v.id} value={v.id} className="whitespace-normal break-words">
                                    {itemLabel}
                                  </Select.Item>
                                )
                              })
                            )}
                          </Select.Content>
                        </Select>
                      </div>
                      <Input
                        type="number"
                        min={0.5}
                        step={0.5}
                        className="col-span-1 w-16 shrink-0"
                        value={ing.quantity}
                        onChange={(e) =>
                          updateIngredient(idx, "quantity", parseFloat(e.target.value) || 1)
                        }
                        placeholder="Qty"
                      />
                      <Input
                        className="col-span-2 min-w-0"
                        value={ing.unit ?? ""}
                        onChange={(e) =>
                          updateIngredient(idx, "unit", e.target.value || null)
                        }
                        placeholder="Unit"
                      />
                      <Input
                        className="col-span-3 min-w-0"
                        value={ing.label ?? ""}
                        onChange={(e) =>
                          updateIngredient(idx, "label", e.target.value || null)
                        }
                        placeholder="Label (optional)"
                      />
                      <Input
                        type="number"
                        min={0}
                        className="col-span-1 w-12 shrink-0"
                        value={ing.display_order}
                        onChange={(e) =>
                          updateIngredient(idx, "display_order", parseInt(e.target.value, 10) || 0)
                        }
                        title="Order"
                      />
                      <div className="col-span-1 flex justify-end">
                        <Button
                          size="small"
                          variant="transparent"
                          onClick={() => removeIngredient(idx)}
                        >
                          <Trash />
                        </Button>
                      </div>
                    </div>
                  ); })}
                  <Button size="small" variant="secondary" onClick={addIngredient}>
                    <Plus /> Add Ingredient
                  </Button>

                  <div className="flex gap-2 mt-4">
                    <Button onClick={handleSubmit} disabled={isSaving}>
                      {editingId ? "Update Recipe" : "Create Recipe"}
                    </Button>
                    <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>

                {/* Right: serving details */}
                <div className="flex flex-col gap-4 lg:border-l lg:border-ui-border-base lg:pl-6 lg:pt-0 pt-4 border-t border-ui-border-base">
                  <Heading level="h3" className="text-base">Serving details</Heading>
                  <div className="flex flex-col gap-2">
                    <Label>Servings</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.servings ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          servings: e.target.value ? parseInt(e.target.value, 10) : null,
                        }))
                      }
                      placeholder="4"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Prep (min)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.prep_time_minutes ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          prep_time_minutes: e.target.value
                            ? parseInt(e.target.value, 10)
                            : null,
                        }))
                      }
                      placeholder="15"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Cook (min)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.cook_time_minutes ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          cook_time_minutes: e.target.value
                            ? parseInt(e.target.value, 10)
                            : null,
                        }))
                      }
                      placeholder="30"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Status</Label>
                    <Select
                      value={form.status ?? "draft"}
                      onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                    >
                      <Select.Trigger>
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="draft">Draft</Select.Item>
                        <Select.Item value="published">Published</Select.Item>
                      </Select.Content>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer>

      <Prompt open={!!deleteRecipe} onOpenChange={(open) => !open && setDeleteRecipe(null)}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Delete recipe</Prompt.Title>
            <Prompt.Description>
              Delete “{deleteRecipe?.title}”? Steps and ingredients will be removed. This cannot be undone.
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel onClick={() => setDeleteRecipe(null)}>Cancel</Prompt.Cancel>
            <Prompt.Action
              onClick={() => deleteRecipe && deleteMutation.mutate(deleteRecipe.id)}
              className="bg-ui-tag-red-bg text-ui-tag-red-text hover:bg-ui-tag-red-bg-hover"
            >
              Delete
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Recipes",
  icon: DocumentText,
})

export const handle = {
  breadcrumb: () => "Recipes",
}

export default RecipeManagementPage
