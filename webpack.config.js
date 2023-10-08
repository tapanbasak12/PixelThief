const path = require('path');
const ignore_externals = require('webpack-node-externals');

module.exports = [
    {
        entry: './src/attack.ts',
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
            ],
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
        },
        output: {
            filename: 'attack.js',
            path: path.resolve(__dirname, 'dist'),
        },
    },
    {
        entry: './src/attack-pixels.ts',
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
            ],
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
        },
        output: {
            filename: 'attack-pixels.js',
            path: path.resolve(__dirname, 'dist'),
        },
        externals: {
            'plotly.js': 'window.Plotly',
        },
    },
    {
        entry: './src/server/main.ts',
        module: {
            rules: [
                {
                    exclude: /node_modules/,
                },
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
            ],
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
        },
        externals: [ignore_externals()],
        output: {
            filename: 'server.js',
            path: path.resolve(__dirname, 'dist'),
        },
        target: 'node',
    }
];
