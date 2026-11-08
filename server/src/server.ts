import {createApp} from './app';
import {env} from './config/env';

createApp().listen(env.PORT, () => console.log(`API listening on port ${env.PORT}`));
