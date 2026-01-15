export default {
    server: {
        allowedHosts: true,
        fs: {
            allow: [
                '.',
                'D:/node_cache/pnpm-cache'
            ]
        }
    },
    // esbuild automatically handles .tsx files
    esbuild: {
        jsxInject: `import React from 'react'`
    }
};
