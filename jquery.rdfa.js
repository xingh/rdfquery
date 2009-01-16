/*
 * jQuery RDFa @VERSION
 * 
 * Copyright (c) 2008 Jeni Tennison
 * Licensed under the MIT (MIT-LICENSE.txt)
 *
 * Depends:
 *  jquery.uri.js
 *  jquery.xmlns.js
 *  jquery.curie.js
 *  jquery.datatype.js
 *  jquery.rdf.js
 */
/*global jQuery */
(function ($) {

  var 
    ns = {
      rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      xsd: "http://www.w3.org/2001/XMLSchema#"
    },

    rdfXMLLiteral = ns.rdf + 'XMLLiteral',

    rdfaCurieDefaults = $.fn.curie.defaults,

    rdfAttributes = ['about', 'href', 'src', 'resource', 'property', 
                     'rel', 'rev', 'typeof', 'content', 'datatype', 
                     'lang', 'xml:lang'],

    attRegex = /\s([^ =]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

    getAttributes = function (elem) {
      var i, e, a, name, value, attMap, ns = {}, atts = {};
      e = elem[0];
      ns[':length'] = 0;
      if (e.outerHTML !== undefined) {
        tag = /<[^>]+>/.exec(e.outerHTML);
        a = attRegex.exec(tag);
        while (a !== null) {
          name = a[1];
          value = a[2] || a[3];
          if (/^xmlns/.test(name)) {
            prefix = /^xmlns(:(.+))?$/.exec(name)[2] || '';
            ns[prefix] = $.uri(value);
            ns[':length'] += 1;
          } else if (/rel|rev|lang|xml:lang/.test(name)) {
            atts[name] = value === '' ? undefined : value;
          } else if (/about|href|src|resource|property|typeof|content|datatype/.test(name)) {
            atts[name] = value === null ? undefined : value;
          }
          a = attRegex.exec(tag);
        }
        attRegex.lastIndex = 0;
      } else {
        attMap = e.attributes;
        for (i = 0; i < attMap.length; i += 1) {
          a = attMap[i];
          if (/^xmlns/.test(a.nodeName)) {
            prefix = /^xmlns(:(.+))?$/.exec(a.nodeName)[2] || '';
            ns[prefix] = $.uri(a.nodeValue);
            ns[':length'] += 1;
          } else if (/rel|rev|lang|xml:lang/.test(a.nodeName)) {
            atts[a.nodeName] = a.nodeValue === '' ? undefined : a.nodeValue;
          } else if (/about|href|src|resource|property|typeof|content|datatype/.test(a.nodeName)) {
            atts[a.nodeName] = a.nodeValue === null ? undefined : a.nodeValue;
          }
        }
      }
      return { atts: atts, namespaces: ns };
    },

    getAttribute = function (elem, attr) {
      var val = elem[0].getAttribute(attr);
      if (attr === 'rev' || attr === 'rel' || attr === 'lang' || attr === 'xml:lang') {
        val = val === '' ? undefined : val;
      }
      return val === null ? undefined : val;
    },

    resourceFromUri = function (uri) {
      return $.rdf.resource(uri);
    },
    
    resourceFromCurie = function (curie, elem, options) {
      if (curie.substring(0, 2) === '_:') {
        return $.rdf.blank(curie);
      } else {
        try {
          return resourceFromUri($.curie(curie, options));
        } catch (e) {
          return undefined;
        }
      }
    },
    
    resourceFromSafeCurie = function (safeCurie, elem, options) {
      var m = /^\[([^\]]+)\]$/.exec(safeCurie);
      return m ? resourceFromCurie(m[1], elem, options) : resourceFromUri($.uri(safeCurie));
    },

    resourcesFromCuries = function (curies, elem, options) {
      var i, resource, resources = [];
      curies = curies && curies.split ? curies.split(/\s+/) : [];
      for (i = 0; i < curies.length; i += 1) {
        if (curies[i] !== '') {
          resource = resourceFromCurie(curies[i], elem, options);
          if (resource !== undefined) {
            resources.push(resource);
          }
        }
      }
      return resources;
    },

    getObjectResource = function (elem, context, relation) {
      var r, resource, atts, curieOpts;
      context = context || {};
      atts = context.atts || getAttributes(elem).atts;
      r = relation === undefined ? atts.rel !== undefined || atts.rev !== undefined : relation;
      resource = atts.resource;
      resource = resource === undefined ? atts.href : resource;
      if (resource === undefined) {
        resource = r ? $.rdf.blank('[]') : resource;
      } else {
        curieOptions = context.curieOptions || $.extend({}, rdfaCurieDefaults, { namespaces: elem.xmlns() });
        resource = resourceFromSafeCurie(resource, elem, curieOptions);
      }
      return resource;
    },

    getSubject = function (elem, context, relation) {
      var r, atts, curieOptions, subject, skip = false;
      context = context || {};
      atts = context.atts || getAttributes(elem).atts;
      curieOptions = context.curieOptions || $.extend({}, rdfaCurieDefaults, { namespaces: elem.xmlns() });
      r = relation === undefined ? atts.rel !== undefined || atts.rev !== undefined : relation;
      if (atts.about !== undefined) {
        subject = resourceFromSafeCurie(atts.about, elem, curieOptions);
      }
      if (subject === undefined && atts.src !== undefined) {
        subject = resourceFromSafeCurie(atts.src, elem, curieOptions);
      }
      if (!r && subject === undefined && atts.resource !== undefined) {
        subject = resourceFromSafeCurie(atts.resource, elem, curieOptions);
      }
      if (!r && subject === undefined && atts.href !== undefined) {
        subject = resourceFromSafeCurie(atts.href, elem, curieOptions);
      }
      if (subject === undefined) {
        if (elem.is('head') || elem.is('body')) {
          subject = $.rdf.resource('<>');
        } else if (atts['typeof'] !== undefined) {
          subject = $.rdf.blank('[]');
        } else if (elem.parent().is('*')) {
          subject = context.object || getObjectResource(elem.parent()) || getSubject(elem.parent()).subject;
          skip = !r && atts.property === undefined;
        } else {
          subject = $.rdf.resource('<>');
        }
      }
      return { subject: subject, skip: skip };
    },
    
    getLang = function (elem, context) {
      var atts, lang, parent;
      context = context || {};
      atts = context.atts || getAttributes(elem).atts;
      lang = atts['xml:lang'];
      lang = lang === undefined ? atts.lang : lang;
      if (lang === undefined) {
        if (context.lang) {
          lang = context.lang;
        } else {
          parent = elem.parent();
          if (parent.is('*')) {
            lang = getLang(parent);
          }
        }
      }
      return lang;
    },

    entity = function (c) {
      switch (c) {
      case '<': 
        return '&lt;';
      case '"': 
        return '&quot;';
      case '&': 
        return '&amp;';
      }
    },

    attRegex = /\s([^ =]+)(\s*=\s*("([^"]*)"|'([^']*)'))?/g,

    serialize = function (elem) {
      var i, string = '', atts, a, name, ns, tag;
      elem.contents().each(function () {
        var j = $(this),
          e = j[0];
        if (j.is('[nodeType=1]')) { // tests whether the node is an element
          name = e.nodeName.toLowerCase();
          ns = j.xmlns('');
          string += '<' + name;
          if (e.outerHTML) {
            tag = /<[^>]+>/.exec(e.outerHTML);
            a = attRegex.exec(tag);
            while (a !== null) {
              if (!/^jQuery/.test(a[1])) {
                string += ' ' + a[1] + '=';
                string += a[2] ? a[3] : '"' + a[1] + '"';
              }
              a = attRegex.exec(tag);
            }
            attRegex.lastIndex = 0;
          } else {
            atts = e.attributes;          
            for (i = 0; i < atts.length; i += 1) {
              a = atts.item(i);
              string += ' ' + a.nodeName + '="';
              string += a.nodeValue.replace(/[<"&]/g, entity);
              string += '"';
            }
          }
          if (ns !== undefined && j.attr('xmlns') === undefined) {
            string += ' xmlns="' + ns + '"';
          }
          string += '>';
          string += j.html();
          string += '</' + name + '>';
        } else if (j.is('[nodeType=8]')) { // tests whether the node is a comment
          string += '<!--';
          string += e.nodeValue;
          string += '-->';
        } else {
          string += e.nodeValue;
        }
      });
      return string;
    },
    
    rdfa = function (context) {
      var i, subject, value, resource, lang, datatype, content, 
        types, type, object, triple, parent,
        properties, rels, revs, 
        forward, backward,
        triples = [],
        attsAndNs, atts, namespaces, ns;
      context = context || {};
      forward = context.forward || [];
      backward = context.backward || [];
      attsAndNs = getAttributes(this);
      atts = attsAndNs.atts;
      context.atts = atts;
      namespaces = context.namespaces || this.xmlns();
      if (attsAndNs.namespaces[':length'] > 0) {
        for (ns in attsAndNs.namespaces) {
          namespaces[ns] = attsAndNs.namespaces[ns];
        }
      }
      //namespaces = this.xmlns(undefined, undefined, context.namespaces);
      context.curieOptions = $.extend({}, rdfaCurieDefaults, { namespaces: namespaces });
      ///*
      subject = getSubject(this, context);
      lang = getLang(this, context);
      if (subject.skip) {
        rels = context.forward;
        revs = context.backward;
        subject = context.subject;
        object = context.object;
      } else {
        subject = subject.subject;
        if (forward.length > 0 || backward.length > 0) {
          parent = context.subject || getSubject(this.parent()).subject;
          for (i = 0; i < forward.length; i += 1) {
            triple = $.rdf.triple(parent, forward[i], subject, { source: this[0] });
            triples.push(triple);
          }
          for (i = 0; i < backward.length; i += 1) {
            triple = $.rdf.triple(subject, backward[i], parent, { source: this[0] });
            triples.push(triple);
          }
        }
        resource = getObjectResource(this, context);
        types = resourcesFromCuries(atts['typeof'], this, context.curieOptions);
        for (i = 0; i < types.length; i += 1) {
          triple = $.rdf.triple(subject, $.rdf.type, types[i], { source: this[0] });
          triples.push(triple);
        } 
        properties = resourcesFromCuries(atts.property, this, context.curieOptions);
        if (properties.length > 0) {
          datatype = atts.datatype;
          content = atts.content;
          if (datatype !== undefined && datatype !== '') {
            datatype = this.curie(datatype);
            if (datatype === rdfXMLLiteral) {
              object = $.rdf.literal(serialize(this), { datatype: rdfXMLLiteral });
            } else if (content !== undefined) {
              object = $.rdf.literal(content, { datatype: datatype });
            } else {
              object = $.rdf.literal(this.text(), { datatype: datatype });
            }
          } else if (content !== undefined) {
            if (lang === undefined) {
              object = $.rdf.literal('"' + content + '"');
            } else {
              object = $.rdf.literal(content, { lang: lang });
            }
          } else if (this.children('*').length === 0 ||
                     datatype === '') {
            lang = getLang(this, context);
            if (lang === undefined) {
              object = $.rdf.literal('"' + this.text() + '"');
            } else {
              object = $.rdf.literal(this.text(), { lang: lang });
            }
          } else {
            object = $.rdf.literal(serialize(this), { datatype: rdfXMLLiteral });
          }
          for (i = 0; i < properties.length; i += 1) {
            triple = $.rdf.triple(subject, properties[i], object, { source: this[0] });
            triples.push(triple);
          }
        }
        rels = resourcesFromCuries(atts.rel, this, context.curieOptions);
        revs = resourcesFromCuries(atts.rev, this, context.curieOptions);
        if (atts.resource !== undefined || atts.href !== undefined) {
          // make the triples immediately
          if (rels !== undefined) {
            for (i = 0; i < rels.length; i += 1) {
              triple = $.rdf.triple(subject, rels[i], resource, { source: this[0] });
              triples.push(triple);
            }
          }
          rels = [];
          if (revs !== undefined) {
            for (i = 0; i < revs.length; i += 1) {
              triple = $.rdf.triple(resource, revs[i], subject, { source: this[0] });
              triples.push(triple);
            }
          }
          revs = [];
        }
      }
      //*/
      this.children().each(function () {
        triples = triples.concat(rdfa.call($(this), { forward: rels, backward: revs, subject: subject, object: resource || subject, lang: lang, namespaces: namespaces }));
      });
      return triples;
    },
    
    gleaner = function (options) {
      var type, atts;
      if (options && options.about !== undefined) {
        atts = getAttributes(this).atts;
        if (options.about === null) {
          return atts.property !== undefined || 
                 atts.rel !== undefined || 
                 atts.rev !== undefined || 
                 atts['typeof'] !== undefined;
        } else {
          return getSubject(this, {atts: atts}).subject.uri === options.about;
        }
      } else if (options && options.type !== undefined) {
        type = getAttribute(this, 'typeof');
        if (type !== undefined) {
          return options.type === null ? true : this.curie(type) === options.type;
        }
        return false;
      } else {
        return rdfa.call(this);
      }
    },
    
    nsCounter = 1,
    
    createCurieAttr = function (elem, attr, uri) {
      var m, curie, value;
      try {
        curie = elem.createCurie(uri);
      } catch (e) {
        if (uri.toString() === rdfXMLLiteral) {
          elem.attr('xmlns:rdf', ns.rdf);
          curie = 'rdf:XMLLiteral';
        } else {
          m = /^(.+[\/#])([^#]+)$/.exec(uri);
          elem.attr('xmlns:ns' + nsCounter, m[1]);
          curie = 'ns' + nsCounter + ':' + m[2];
          nsCounter += 1;
        }
      }
      value = getAttribute(elem, attr);
      if (value !== undefined) {
        if ($.inArray(curie, value.split(/\s+/)) === -1) {
          elem.attr(attr, value + ' ' + curie);
        }
      } else {
        elem.attr(attr, curie);
      }
    },
    
    createResourceAttr = function (elem, attr, resource) {
      var ref;
      if (resource.blank) {
        ref = '[_:' + resource.id + ']';
      } else {
        ref = $.uri.base().relative(resource.uri);
      }
      elem.attr(attr, ref);
    },
    
    createSubjectAttr = function (elem, subject) {
      var s = getSubject(elem).subject;
      if (subject !== s) {
        createResourceAttr(elem, 'about', subject);
      }
      elem.removeData('rdfa.subject');
    },
    
    createObjectAttr = function (elem, object) {
      var o = getObjectResource(elem);
      if (object !== o) {
        createResourceAttr(elem, 'resource', object);
      }
      elem.removeData('rdfa.objectResource');
    },
    
    resetLang = function (elem, lang) {
      elem.wrapInner('<span></span>')
        .children('span')
        .attr('lang', lang);
      return elem;
    },
    
    addRDFa = function (triple) {
      var hasContent, hasRelation, hasRDFa, overridableObject, span,
        subject, sameSubject,
        object, sameObject,
        lang, content,
        i, atts,
        ns = this.xmlns();
      span = this;
      atts = getAttributes(this).atts;
      if (typeof triple === 'string') {
        triple = $.rdf.triple(triple, { namespaces: ns, base: $.uri.base() });
      } else if (triple.rdfquery) {
        addRDFa.call(this, triple.sources().get(0));
        return this;
      } else if (triple.length) {
        for (i = 0; i < triple.length; i += 1) {
          addRDFa.call(this, triple[i]);
        }
        return this;
      }
      hasRelation = atts.rel !== undefined || atts.rev !== undefined;
      hasRDFa = hasRelation || atts.property !== undefined || atts['typeof'] !== undefined;
      if (triple.object.resource) {
        subject = getSubject(this, {atts: atts}, true).subject;
        object = getObjectResource(this, {atts: atts}, true);
        overridableObject = !hasRDFa && atts.resource === undefined;
        sameSubject = subject === triple.subject;
        sameObject = object === triple.object;
        if (triple.property === $.rdf.type) {
          if (sameSubject) {
            createCurieAttr(this, 'typeof', triple.object.uri);
          } else if (hasRDFa) {
            span = this.wrapInner('<span />').children('span');
            createCurieAttr(span, 'typeof', triple.object.uri);
            if (object !== triple.subject) {
              createSubjectAttr(span, triple.subject);
            }
          } else {
            createCurieAttr(this, 'typeof', triple.object.uri);
            createSubjectAttr(this, triple.subject);
          }
        } else if (sameSubject) {
          // use a rel
          if (sameObject) {
            createCurieAttr(this, 'rel', triple.property.uri);
          } else if (overridableObject || !hasRDFa) {
            createCurieAttr(this, 'rel', triple.property.uri);
            createObjectAttr(this, triple.object);
          } else {
            span = this.wrap('<span />').parent();
            createCurieAttr(span, 'rev', triple.property.uri);
            createSubjectAttr(span, triple.object);
          }
        } else if (subject === triple.object) {
          if (object === triple.subject) {
            // use a rev
            createCurieAttr(this, 'rev', triple.property.uri);
          } else if (overridableObject || !hasRDFa) {
            createCurieAttr(this, 'rev', triple.property.uri);
            createObjectAttr(this, triple.subject);
          } else {
            // wrap in a span with a rel
            span = this.wrap('<span />').parent();
            createCurieAttr(span, 'rel', triple.property.uri);
            createSubjectAttr(span, triple.subject);
          }
        } else if (sameObject) {
          if (hasRDFa) {
            // use a rev on a nested span
            span = this.wrapInner('<span />').children('span');
            createCurieAttr(span, 'rev', triple.property.uri);
            createObjectAttr(span, triple.subject);
            span = span.wrapInner('<span />').children('span');
            createSubjectAttr(span, triple.object);
            span = this;
          } else {
            createSubjectAttr(this, triple.subject);
            createCurieAttr(this, 'rel', triple.property.uri);
          }
        } else if (object === triple.subject) {
          if (hasRDFa) {
            // wrap the contents in a span and use a rel
            span = this.wrapInner('<span />').children('span');
            createCurieAttr(span, 'rel', this.property.uri);
            createObjectAttr(span, triple.object);
            span = span.wrapInner('<span />').children('span');
            createSubjectAttr(span, object);
            span = this;
          } else {
            // use a rev on this element
            createSubjectAttr(this, triple.object);
            createCurieAttr(this, 'rev', triple.property.uri);
          }
        } else if (hasRDFa) {
          span = this.wrapInner('<span />').children('span');
          createCurieAttr(span, 'rel', triple.property.uri);
          createSubjectAttr(span, triple.subject);
          createObjectAttr(span, triple.object);
          if (span.children('*').length > 0) {
            span = this.wrapInner('<span />').children('span');
            createSubjectAttr(span, subject);
          }
          span = this;
        } else {
          createCurieAttr(span, 'rel', triple.property.uri);
          createSubjectAttr(this, triple.subject);
          createObjectAttr(this, triple.object);
          if (this.children('*').length > 0) {
            span = this.wrapInner('<span />').children('span');
            createSubjectAttr(span, subject);
            span = this;
          }
        }
      } else {
        subject = getSubject(this, {atts: atts}).subject;
        object = getObjectResource(this, {atts: atts});
        sameSubject = subject === triple.subject;
        hasContent = this.text() !== triple.object.value;
        if (atts.property !== undefined) {
          content = atts.content;
          sameObject = content !== undefined ? content === triple.object.value : !hasContent;
          if (sameSubject && sameObject) {
            createCurieAttr(this, 'property', triple.property.uri);
          } else {
            span = this.wrapInner('<span />').children('span');
            return addRDFa.call(span, triple);
          }
        } else {
          if (object === triple.subject) {
            span = this.wrapInner('<span />').children('span');
            return addRDFa.call(span, triple);
          }
          createCurieAttr(this, 'property', triple.property.uri);
          createSubjectAttr(this, triple.subject);
          if (hasContent) {
            if (triple.object.datatype && triple.object.datatype.toString() === rdfXMLLiteral) {
              this.html(triple.object.value);
            } else {
              this.attr('content', triple.object.value);
            }
          }
          lang = getLang(this);
          if (triple.object.lang) {
            if (lang !== triple.object.lang) {
              this.attr('lang', triple.object.lang);
              if (hasContent) {
                resetLang(this, lang);
              }
            }
          } else if (triple.object.datatype) {
            createCurieAttr(this, 'datatype', triple.object.datatype);
          } else {
            // the empty datatype ensures that any child elements that might be added won't mess up this triple
            if (!hasContent) {
              this.attr('datatype', '');
            }
            // the empty lang ensures that a language won't be assigned to the literal
            if (lang !== undefined) {
              this.attr('lang', '');
              if (hasContent) {
                resetLang(this, lang);
              }
            }
          }
        }
      }
      this.parents().andSelf().trigger("rdfChange");
      return span;
    };

  $.fn.rdfa = function (triple) {
    if (triple === undefined) {
      var triples = $.map($(this), function (elem) {
        return rdfa.call($(elem));
      });
      return $.rdf({ triples: triples });
    } else {
      $(this).each(function () {
        addRDFa.call($(this), triple);
      });
      return this;
    }
  };

  $.rdf.gleaners.push(gleaner);

})(jQuery);