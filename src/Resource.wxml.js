const wxml = require("wxml")
const babel = require("@babel/core")
const types = require("@babel/types")
const evnReplace = require("./envReplacePlugin")

const Resource = require("./Resource")

module.exports = class WXMLResource extends Resource {
    constructor(filePath) {
        super(filePath)
        this.pages = new Set()
        !this.notFound && this.complier()
    }
    complier() {
        const ast = wxml.parse(this.source.toString())
        const self = this
        try {
            // @ts-ignore
            wxml.traverse(ast, (node) => {
                if (node.type === 1) { // element node
                    Object.keys(node.attributes).forEach(attr => {
                        // console.log(attr, node.attributes[attr])
                        if (typeof node.attributes[attr] === "string") {
                            let note = false
                            node.attributes[attr] = node.attributes[attr].replace(/{{(.+?)}}/g, (_, snp) => {
                                try {
                                    note = true
                                    const r = babel.transformSync(snp, {
                                        plugins: [evnReplace, {
                                            visitor: {
                                                StringLiteral(path) {
                                                    if (attr === "src")
                                                        if (!/^https?:\/\//.test(path.node.value)) {
                                                            if (path.node.value) {
                                                                const index = path.node.value.indexOf("?")
                                                                let value = path.node.value
                                                                if (index > 0) {
                                                                    value = value.slice(0, index)
                                                                }
                                                                self.resolve(value, self.requires)
                                                            } else {
                                                                console.log("[引用错误]".red, self.path.replace(process.cwd(), "."), "src=\"" + path.node.value + "\"")
                                                            }
                                                        }
                                                    if (attr === "url")
                                                        if (!/^https?:\/\//.test(path.node.value)) {
                                                            if (path.node.value) {
                                                                const index = path.node.value.indexOf("?")
                                                                let value = path.node.value
                                                                if (index > 0) {
                                                                    value = value.slice(0, index)
                                                                }
                                                                self.resolve(value, self.pages)
                                                            } else {
                                                                console.log("[引用错误]".red, self.path.replace(process.cwd(), "."), "url=\"" + path.node.value + "\"")
                                                            }
                                                        }
                                                },
                                                CallExpression(path) {
                                                    // @ts-ignore
                                                    if (path.node.callee.name === "page") {
                                                        // @ts-ignore
                                                        self.resolve(path.node.arguments[0].value, self.pages)
                                                        // @ts-ignore
                                                        path.replaceWith(types.valueToNode(path.node.arguments[0].value.replace(/^@/, "/")))
                                                        return
                                                    }
                                                    // @ts-ignore
                                                    if (path.node.callee.name === "file") {
                                                        // @ts-ignore
                                                        const file = path.node.arguments[0].value
                                                        // @ts-ignore
                                                        path.replaceWith(types.valueToNode(file.replace(/^@/, "/")))
                                                        self.resolve(file, self.requires)
                                                        return
                                                    }
                                                }
                                            }
                                        }]
                                    })
                                    return "{{" + r.code + "}}"
                                } catch (error) {
                                    console.error("[语法警告]", ("<" + node.tagName + " ... " + attr + "=\"" + node.attributes[attr] + (node.selfClosing ? "\"/>" : "\"><" + node.tagName + ">")).blue, this.path.replace(process.cwd(), "."))
                                    return "{{" + snp + "}}"
                                }
                            }).replace(/"/g, "'").replace(/;}}/g, "}}")

                            if (!note) {
                                if (attr === "src")
                                    if (!/^https?:\/\//.test(node.attributes[attr])) {
                                        if (node.attributes[attr]) {
                                            const index = node.attributes[attr].indexOf("?")
                                            let value = node.attributes[attr]
                                            if (index > 0) {
                                                value = value.slice(0, index)
                                            }
                                            this.resolve(value, this.requires)
                                            node.attributes[attr] = node.attributes[attr].replace(/^@/, "/")
                                        } else {
                                            console.log("[引用错误] ".red, self.path, "src=\"" + node.attributes[attr] + "\"")
                                        }
                                    }

                                if (attr === "url")
                                    if (!/^https?:\/\//.test(node.attributes[attr])) {
                                        if (node.attributes[attr]) {
                                            const index = node.attributes[attr].indexOf("?")
                                            let value = node.attributes[attr]
                                            if (index > 0) {
                                                value = value.slice(0, index)
                                            }
                                            this.resolve(value, this.pages)
                                            node.attributes[attr] = node.attributes[attr].replace(/^@/, "/")
                                        } else {
                                            console.log("[引用错误] ".red, self.path, "url=\"" + node.attributes[attr] + "\"")
                                        }
                                    }
                            }
                        }
                        if (attr === "class" && process.env.APP_NAME)
                            node.attributes[attr] = process.env.APP_NAME + " " + node.attributes[attr]
                    })
                    if (node.tagName === "style") node.childNodes = []
                }
                if (node.type === 3 && node.textContent.replace(/^.$/g, "")) { // text node
                    node.textContent = node.textContent.replace(/{{(.+?)}}/, (_, snp) => {

                        const r = babel.transformSync(snp, { plugins: [evnReplace] })
                        return "{{" + r.code + "}}"

                    }).replace(/"/g, "'").replace(/;}}/g, "}}")
                }
            })

            // @ts-ignore
            this.content = wxml.serialize(ast)
        } catch (error) {
            console.log("编译失败".red, this.path)
            console.log(error)
            process.exit(0)
        }
    }

}
