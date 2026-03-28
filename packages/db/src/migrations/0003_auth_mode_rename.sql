UPDATE `users` SET `auth_mode` = 'phavo-net'
WHERE `auth_mode` = 'phavo-io';

UPDATE `sessions` SET `auth_mode` = 'phavo-net'
WHERE `auth_mode` = 'phavo-io';