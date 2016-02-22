"use strict";

var AmiMotleyTool = require("../lib/ami-motley-tool");
var amt = new AmiMotleyTool({ region: "ap-northeast-1" });

var assert = require("assert");

describe("AmiMotleyTool", function() {
  describe("getTagValue", function () {
    it("should work", function () {
      assert.equal("foo1", amt.getTagValue({ Tags: [ { Key: "foo", Value: "foo1" }, { Key: "bar", Value: "bar1" }, { Key: "buz", Value: "buz1" } ] }, "foo"));
      assert.equal("bar1", amt.getTagValue({ Tags: [ { Key: "foo", Value: "foo1" }, { Key: "bar", Value: "bar1" }, { Key: "buz", Value: "buz1" } ] }, "bar"));
      assert.equal("buz1", amt.getTagValue({ Tags: [ { Key: "foo", Value: "foo1" }, { Key: "bar", Value: "bar1" }, { Key: "buz", Value: "buz1" } ] }, "buz"));
      assert.equal(null, amt.getTagValue({ Tags: [ { Key: "foo", Value: "foo1" }, { Key: "bar", Value: "bar1" }, { Key: "buz", Value: "buz1" } ] }, "xxx"));
      assert.equal(null, amt.getTagValue({ Tags: [ ] }, "xxx"));
      assert.equal(null, amt.getTagValue({ }, "xxx"));
    });
  });
  describe("covertTagsToMap", function () {
    it("should work", function () {
      var map = amt.covertTagsToMap([ { Key: "foo", Value: "foo1" }, { Key: "bar", Value: "bar1" }, { Key: "buz", Value: "buz1" } ]);
      assert.equal("foo1", map.foo);
      assert.equal("bar1", map.bar);
      assert.equal("buz1", map.buz);
      assert.equal(undefined, map.xxx);
    });
  });
  describe("getFilters", function () {
    it("should work", function () {
      var filters = amt.getFilters({ foo: "foo1" });
      assert.equal("tag:foo", filters[0].Name);
      assert.equal("foo1", filters[0].Values[0]);
    });
  });
});
