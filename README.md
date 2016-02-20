# AMI Motley Tool

Utility methods for AMI.

## Instration

```bash
$ npm install ami-motley-tool
```

## Usase

```javascript
var AmiMotleyTool = require("ami-motley-tool");
var amt = new AmiMotleyTool();
amt.getSortedGroupImages({ Name: "Foo", Role: "Web Server" }).then(function(images) {
  ...
}).catch(function(err) {
  console.log(err);
});
```

## License

```
Copyright 2016 t-yamo

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
