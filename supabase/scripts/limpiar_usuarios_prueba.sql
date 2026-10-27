-- Borra los usuarios de prueba que crean pruebas/ y pruebas-navegador/.
--
-- Solo los anónimos marcados en app_metadata (raw_app_meta_data), que únicamente la service role
-- puede escribir. Nunca se filtra por user_metadata: el propio usuario lo puede editar (R12).
-- El ON DELETE CASCADE borra sus cuentas, categorías, movimientos y fallas simuladas.

DELETE FROM auth.users
 WHERE is_anonymous = true
   AND raw_app_meta_data->>'es_prueba' = 'true';
