"use strict";

var AWS = require("aws-sdk-promise");
var Promise = require("promise");

/**
 * @class AmiMotleyTool
 * @param {object} opts : http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html#constructor-property
 */
var AmiMotleyTool = module.exports = function(opts) {
  this.ec2 = new AWS.EC2(opts);
};

AmiMotleyTool.prototype = {
  /**
   * getTagValue
   * get target tag value from description of image or instance
   * @param {object} description
   * @param {string} key
   */
  getTagValue: function(description, key) {
    for (var tag in description.Tags) {
      if (tag.Key === key) {
        return tag.Value;
      }
    }
    return null;
  },
  /**
   * getFilters
   * get filters from group.
   * @param {object} group : `{ foo: "bar", foo2: "bar2" }`
   * @return {array} `[ { Name: "tag:foo", Values: [ "bar" ] }, { Name: "tag:foo2", Values: [ "bar2" ] }... ]`
   */
  getFilters: function(group) {
    return Object.keys(group).map(function(key) {
      return {
        Name: "tag:" + key,
        Values: [ group[key] ]
      };
    });
  },
  /**
   * getGroupImages
   * get filtered (group) images.
   * @param {object} group : `{ foo: "bar", foo2: "bar2" }` tag:foo = "bar", tag:foo2 = "bar2"
   * @return {promse} : {array} images
   */
  getGroupImages: function(group) {
    return new Promise(function(resolve, reject) {
      this.ec2.describeImages({
        Filters: this.getFilters(group)
      }).promise().then(function(req) {
        resolve(req.Images);
      }).catch(function(err) {
        reject(err);
      });
    });
  },
  /**
   * getSortedGroupImages
   * get filtered (group) and sorted (versionTag ASC as string) images.
   * @param {object} group : `{ foo: "bar", foo2: "bar2" }` tag:foo = "bar", tag:foo2 = "bar2"
   * @param {string} versionTag
   * @return {promise} : {array} images
   */
  getSortedGroupImages: function(group, versionTag) {
    return new Promise(function(resolve, reject) {
      this.getGroupImages(group)
      .then(function(images) {
        resolve(images.sort(function(a, b) {
          var aVal = this.getTagValue(a, versionTag);
          var bVal = this.getTagValue(b, versionTag);
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
   * @param {object} group : `{ foo: "bar", foo2: "bar2" }` tag:foo = "bar", tag:foo2 = "bar2"
   * @param {string} versionTag
   * @return {promise}
   */
  deleteOldImagesAndSnapshots: function(group, versionTag) {
    return new Promise(function(resolve, reject) {
      this.getSortedGroupImages(group, versionTag)
      .then(function(images) {
        var deleteImages = [];
        var deleteSnapshots = [];
        for (var i = 0; i < images.length - 1; i++) {
          images[i].BlockDeviceMappings.forEach(function(blockDevice) {
            deleteSnapshots.push(this.ec2.deleteSnapshot({ SnapshotId: blockDevice.Ebs.SnapshotId }).promise());
          });
          deleteImages.push(this.ec2.deregisterImage({ ImageId: images[i].ImageId }).promise());
        }
        Promise.all(deleteImages)
        .then(function(res) {
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
    });
  },
  /**
   * createImageAndSnapshotWithTags
   * create image and snapshots with tags of target instance.
   * @param {objct} opts : http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html#createImage-property
   * @return {promise} : {string} image ID
   */
  createImageAndSnapshotWithTags: function(opts) {
    return new Promise(function(resolve, reject) {
      this.ec2.describeInstances({
        InstanceIds : [ opts.InstanceId ]
      }).promise().then(function(req) {
        var instance = req.Reservations[0].Instances[0];
        this.ec2.createImage(opts).promise().then(function(req) {
          var imageId = req.ImageId;
          Promise.all([
            this.setTagsToImage(imageId, instance.Tags),
            this.setTagsToSnapshot(imageId, instance.Tags)
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
    return new Promise(function(resolve, reject) {
      this.ec2.createTags({
        Resources: [ imageId ],
        Tags: tags
      }).promise().then(function(res) {
        resolve(res);
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
    return new Promise(function(resolve, reject) {
      this.ec2.describeImages({
        ImageIds: [ imageId ]
      }).promise().then(function(res) {
        var image = res.Images[0];
        var promises = [];
        image.BlockDeviceMappings.forEach(function(blockDevice) {
          promises.push(this.ec2.createTags({
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
