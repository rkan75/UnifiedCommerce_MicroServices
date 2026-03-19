-- Fixed INSERT for provider_identity: JSON value wrapped in dollar-quoting
-- so the password hash (with +, /, etc.) doesn't break the string literal.
-- Use this if you get "invalid input syntax for type json" or unclosed string.

INSERT INTO provider_identity (
  id,
  entity_id,
  provider,
  auth_identity_id,
  provider_metadata,
  created_at,
  updated_at,
  deleted_at
) VALUES (
  '01KFYYRQMDCBTBGMFQF0Y4RN6S',
  'admin@medusa-test.com',
  'emailpass',
  'authid_01KFYYRQMD04898NQC7DB8NBG4',
  $${"password":"c2NyeXB0AA8AAAAIAAAAAS0ISNdKB+qkigfarPtOM84raOjtdKkl1OQqk91sdgma0MNvlyolKRl6MDDl4VKPy36cxK/bDG47MvEm9gsQQ/VdMTaqMx5dhD7tl3TjgyI+"}$$::jsonb,
  '2026-01-27 05:28:05.005+00',
  '2026-01-27 05:28:05.005+00',
  NULL
);

-- If provider_metadata is type TEXT (not JSONB), use this instead (no ::jsonb):
--
--   $${"password":"c2NyeXB0AA8AAAAIAAAAAS0ISNdKB+qkigfarPtOM84raOjtdKkl1OQqk91sdgma0MNvlyolKRl6MDDl4VKPy36cxK/bDG47MvEm9gsQQ/VdMTaqMx5dhD7tl3TjgyI+"}$$,
