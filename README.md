# AMI Motley Tool

[![npm version][npm-image]][npm-url]

Utility methods for AMI.

## Instration

```bash
$ npm install ami-motley-tool
```

## Usase

```javascript
var AmiMotleyTool = require("ami-motley-tool");
var amt = new AmiMotleyTool();

amt.getSortedGroupImages({ Name: "Foo", Role: "Web Server" }, "BuildNo").then(function(images) {
  ...
}).catch(function(err) {
  console.log(err.stack);
});

amt.createImageAndSnapshotWithTags({ Name: "ami001", InstanceId: "i-123123123" }).then(function(imageId) {
  ...
}).catch(function(err) {
  console.log(err.stack);
});
```

## Methods

See [source](lib/ami-motley-tool.js).

### Utility Methods

|method|arg1|arg2|return|description|
|---|---|---|---|---|
|getTagValue|description (instance, image, other AWS resources)<br>`{ Xxx: "yyy", Tags: [ { Name: "foo1", Value: "bar1" }, { Name: "foo2", Value: "bar2" } ] }`|key<br>`"foo1"`|`"bar1"` <br>(or null)|get target tag value from description of image or instance.|
|covertTagsToMap|tags<br>`[ { Name: "foo", Value: "bar" }, { Name: "foo2", Value: "bar2" }... ]`||`{ foo: bar, foo2: bar2 }`|convert tags to map.|
|getFilters|groupTag<br>`{ foo: "bar", foo2: "bar2" }`||`[ { Name: "tag:foo", Values: [ "bar" ] }, { Name: "tag:foo2", Values: [ "bar2" ] }... ]`|get filters from group.|


### AWS Methods

|method|arg1|arg2|return|description|
|---|---|---|---|---|
|getGroupImages|groupTag<br>`{ foo: "bar", foo2: "bar2" }`||Promise<br>(images)|get filtered (groupTag) images. groupTag is tag set.|
|getSortedGroupImages|groupTag<br>`{ foo: "bar", foo2: "bar2" }`|versionTag<br>`"BuildNo"`|Promise<br>(images)|get filtered (groupTag) and sorted (versionTag ASC as string) images. groupTag is tag set.|
|deleteOldImagesAndSnapshots|groupTag<br>`{ foo: "bar", foo2: "bar2" }`|versionTag<br>`"BuildNo"`|Promise|delete old images and snapshots in target group. (keep latest one)|
|getUsedImageIds|targetTag<br>`{ foo: "bar", foo2: "bar2" }`||Promise|get used image IDs in target group. (AutoScalingGroup and EC2 Instance)|
|deleteUnusedImagesAndSnapshots|groupTag<br>`{ foo: "bar", foo2: "bar2" }`|targetTag<br>`{ foo: "bar", foo2: "bar2" }`|Promise|delete unused images and snapshots in target group. (AutoScalingGroup and EC2 Instance)|
|createImageAndSnapshotWithTags|opts<br>(InstanceId and Name required.<br>[AWS CreateImage Property][aws-create-image-url])||Promise<br>(imageId)|create image and snapshots with tags of target instance. Tag keys starting with "aws:" are reserved.|
|setTagsToImage|imageId|tags|Promise|set tags to image.|
|setTagsToSnapshot|imageId|tags|Promise|set tags to snapshot.|
|waitAvailableAmi|imageId|callbackWait|Promise<br>true:AMI launched.<br>false:AMI launch failed.)|wait available AMI.|

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

[npm-image]:https://badge.fury.io/js/ami-motley-tool.svg?t=20160225
[npm-url]:https://badge.fury.io/js/ami-motley-tool
[aws-create-image-url]:http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html#createImage-property
