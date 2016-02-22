"use strict";

var AWS = require("aws-sdk-promise");
var Promise = require("promise");

/**
 * @class AmiMotleyTool
 * @param {object} opts : http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html#constructor-property / http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/AutoScaling.html#constructor-property
 */
var AmiMotleyTool = module.exports = function(opts) {
  this.ec2 = new AWS.EC2(opts);
  this.asg = new AWS.AutoScaling(opts);
};

var sleep = function(msec) {
  return new Promise(function(resolve, reject) {
    setTimeout(function() { resolve(); }, msec);
  });
};

AmiMotleyTool.prototype = {
  /**
   * getTagValue
   * get target tag value from description of image or instance
   * @param {object} description
   * @param {string} key
   */
  getTagValue: function(description, key) {
    for (var index in description.Tags) {
      if (description.Tags[index].Key === key) {
        return description.Tags[index].Value;
      }
    }
    return null;
  },
  /**
   * covertTagsToMap
   * convert tags to map.
   * @param {array} tags : `[ { Name: "foo", Value: "bar" }, { Name: "foo2", Value: "bar2" }... ]`
   * @return {object} : `{ foo: bar, foo2: bar2 }`
   */
  covertTagsToMap: function(tags) {
    var map = {};
    tags.forEach(function(x) {
      map[x.Key] = x.Value;
    });
    return map;
  },
  /**
   * getFilters
   * get filters from group.
   * @param {object} groupTag : `{ foo: "bar", foo2: "bar2" }`
   * @return {array} : `[ { Name: "tag:foo", Values: [ "bar" ] }, { Name: "tag:foo2", Values: [ "bar2" ] }... ]`
   */
  getFilters: function(groupTag) {
    return Object.keys(groupTag).map(function(key) {
      return {
        Name: "tag:" + key,
        Values: [ groupTag[key] ]
      };
    });
  },
  /**
   * getGroupImages
   * get filtered (groupTag) images.
   * @param {object} groupTag : `{ foo: "bar", foo2: "bar2" }` tag:foo = "bar", tag:foo2 = "bar2"
   * @return {promse} : {array} images
   */
  getGroupImages: function(groupTag) {
    var self = this;
    return new Promise(function(resolve, reject) {
      self.ec2.describeImages({
        Filters: self.getFilters(groupTag)
      }).promise().then(function(req) {
        resolve(req.data.Images);
      }).catch(function(err) {
        reject(err);
      });
    });
  },
  /**
   * getSortedGroupImages
   * get filtered (groupTag) and sorted (versionTag ASC as string) images.
   * @param {object} groupTag : `{ foo: "bar", foo2: "bar2" }` tag:foo = "bar", tag:foo2 = "bar2"
   * @param {string} versionTag
   * @return {promise} : {array} images
   */
  getSortedGroupImages: function(groupTag, versionTag) {
    var self = this;
    return new Promise(function(resolve, reject) {
      self.getGroupImages(groupTag)
      .then(function(images) {
        resolve(images.sort(function(a, b) {
          var aVal = self.getTagValue(a, versionTag);
          var bVal = self.getTagValue(b, versionTag);
          if (aVal < bVal) return -1;
          if (aVal > bVal) return 1;
          return 0;
        }));
      }).catch(function(err) {
        reject(err);
      });
    });
  },
  /**
   * deleteOldImagesAndSnapshots
   * delete old images and snapshots in target group. (keep latest one)
   * @param {object} groupTag : `{ foo: "bar", foo2: "bar2" }` tag:foo = "bar", tag:foo2 = "bar2"
   * @param {string} versionTag
   * @return {promise}
   */
  deleteOldImagesAndSnapshots: function(groupTag, versionTag) {
    var self = this;
    return new Promise(function(resolve, reject) {
      self.getSortedGroupImages(groupTag, versionTag)
      .then(function(images) {
        var deleteImages = [];
        var deleteSnapshots = [];
        for (var i = 0; i < images.length - 1; i++) {
          deleteImages.push(self.ec2.deregisterImage({ ImageId: images[i].ImageId }).promise());
          images[i].BlockDeviceMappings.forEach(function(blockDevice) {
            deleteSnapshots.push(self.ec2.deleteSnapshot({ SnapshotId: blockDevice.Ebs.SnapshotId }).promise());
          });
        }
        Promise.all(deleteImages)
        .then(function(res) {
          sleep(10 * 1000).then(function() {
            Promise.all(deleteSnapshots)
            .then(function(res) {
              resolve(res);
            }).catch(function(err) {
              reject(err);
            });
          }).catch(function(err) {
            reject(err);
          });
        }).catch(function(err) {
          reject(err);
        });
      }).catch(function(err) {
        reject(err);
      });
    });
  },
  /**
   * getUsedImageIds
   * get used image IDs in target group. (AutoScalingGroup and EC2 Instance)
   * @param {object} targetTag : `{ foo: "bar", foo2: "bar2" }` tag:foo = "bar", tag:foo2 = "bar2"
   * @return {promise}
   */
  getUsedImageIds: function(targetTag) {
    var self = this;
    var imageIds = [];
    return new Promise(function(resolve, reject) {
      self.ec2.describeInstances({
        Filters: self.getFilters(targetTag)
      }).promise().then(function(req) {
        req.data.Reservations.forEach(function(reservation) {
          reservation.Instances.forEach(function(x) {
            if (imageIds.indexOf(x.ImageId) === -1 && x.State.Name !== "terminated") {
              imageIds.push(x.ImageId);
            }
          });
        });
        self.asg.describeAutoScalingGroups({
          // N/A
        }).promise().then(function(req) {
          var launchConfigurationNames = [];
          req.data.AutoScalingGroups.forEach(function(x) {
            var asgTags = self.covertTagsToMap(x.Tags);
            for (var key in targetTag) {
              if (!(key in asgTags)) {
                return;
              }
              if (asgTags[key] !== targetTag[key]) {
                return;
              }
            }
            launchConfigurationNames.push(x.LaunchConfigurationName);
          });
          self.asg.describeLaunchConfigurations({
            LaunchConfigurationNames: launchConfigurationNames
          }).promise().then(function(req) {
            req.data.LaunchConfigurations.forEach(function(x) {
              imageIds.push(x.ImageId);
            });
            resolve(imageIds);
          }).catch(function(err) {
            reject(err);
          });
        }).catch(function(err) {
          reject(err);
        });
      }).catch(function(err) {
        reject(err);
      });
    });
  },
  /**
   * deleteUnusedImagesAndSnapshots
   * delete unused images and snapshots in target group. (AutoScalingGroup and EC2 Instance)
   * @param {object} groupTag : `{ foo: "bar", foo2: "bar2" }` tag:foo = "bar", tag:foo2 = "bar2"
   * @param {object} targetTag : `{ foo: "bar", foo2: "bar2" }` tag:foo = "bar", tag:foo2 = "bar2"
   * @return {promise}
   */
  deleteUnusedImagesAndSnapshots: function(groupTag, targetTag) {
    var self = this;
    return new Promise(function(resolve, reject) {
      self.getGroupImages(groupTag)
      .then(function(images) {
        self.getUsedImageIds(targetTag).then(function(usedImages) {
          var deleteImages = [];
          var deleteSnapshots = [];
          for (var i = 0; i < images.length; i++) {
            if (usedImages.indexOf(images[i].ImageId) !== -1) {
              continue;
            }
            deleteImages.push(self.ec2.deregisterImage({ ImageId: images[i].ImageId }).promise());
            images[i].BlockDeviceMappings.forEach(function(blockDevice) {
              deleteSnapshots.push(self.ec2.deleteSnapshot({ SnapshotId: blockDevice.Ebs.SnapshotId }).promise());
            });
          }
          Promise.all(deleteImages)
          .then(function(res) {
            sleep(30 * 1000).then(function() {
              Promise.all(deleteSnapshots)
              .then(function(res) {
                resolve(res);
              }).catch(function(err) {
                reject(err);
              });
            }).catch(function(err) {
              reject(err);
            });
          }).catch(function(err) {
            reject(err);
          });
        }).catch(function(err) {
          reject(err);
        });
      }).catch(function(err) {
        reject(err);
      });
    });
  },
  /**
   * createImageAndSnapshotWithTags
   * create image and snapshots with tags of target instance. Tag keys starting with "aws:" are reserved.
   * @param {objct} opts : InstanceId and Name required. http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html#createImage-property
   * @return {promise} : {string} image ID
   */
  createImageAndSnapshotWithTags: function(opts) {
    var self = this;
    return new Promise(function(resolve, reject) {
      self.ec2.describeInstances({
        InstanceIds : [ opts.InstanceId ]
      }).promise().then(function(req) {
        var instance = req.data.Reservations[0].Instances[0];
        var tags = instance.Tags.filter(function(x) {
          return (x.Key.indexOf("aws:") != 0);
        });
        self.ec2.createImage(opts).promise().then(function(req) {
          var imageId = req.data.ImageId;
          Promise.all([
            self.setTagsToImage(imageId, tags),
            self.setTagsToSnapshot(imageId, tags)
          ]).then(function(res) {
            resolve(imageId);
          }).catch(function(err) {
            reject(err);
          });
        }).catch(function(err) {
          reject(err);
        });
      }).catch(function(err) {
        reject(err);
      });
    });
  },
  /**
   * setTagsToImage
   * set tags to image.
   * @param {string} imageId
   * @param {object} tags
   * @return {promise}
   */
  setTagsToImage: function(imageId, tags) {
    var self = this;
    return new Promise(function(resolve, reject) {
      self.ec2.createTags({
        Resources: [ imageId ],
        Tags: tags
      }).promise().then(function(req) {
        resolve(req);
      }).catch(function(err) {
        reject(err);
      });
    });
  },
  /**
   * setTagsToSnapshot
   * set tags to snapshot.
   * @param {string} imageId
   * @param {object} tags
   * @return {promise}
   */
  setTagsToSnapshot: function(imageId, tags) {
    var self = this;
    return new Promise(function(resolve, reject) {
      self.ec2.describeImages({
        ImageIds: [ imageId ]
      }).promise().then(function(req) {
        var image = req.data.Images[0];
        var promises = [];
        image.BlockDeviceMappings.forEach(function(blockDevice) {
          promises.push(self.ec2.createTags({
            Resources: [ blockDevice.Ebs.SnapshotId ],
            Tags: tags
          }).promise());
        });
        Promise.all(promises)
        .then(function(res) {
          resolve(res);
        }).catch(function(err) {
          reject(err);
        });
      }).catch(function(err) {
        reject(err);
      });
    });
  }
};
