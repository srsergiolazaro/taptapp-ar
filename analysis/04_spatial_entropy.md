# Innovación 04: Localidad Espacial (Curva de Morton)

## El Problema: La fragmentación espacial
En una imagen, los puntos de interés están distribuidos en 2D. Sin embargo, al guardarlos en un archivo, se convierten en una lista 1D.
- **MindAR:** Guarda los puntos según se detectan. Dos puntos que están físicamente pegados en la imagen pueden estar en extremos opuestos del archivo.
- **Impacto:** Esto destruye la eficiencia de los algoritmos de compresión y aumenta los saltos de memoria (cache misses) durante el proceso de matching.

## La Innovación: Ordenación por Curva de Morton (Z-Order Curve)
Taptapp-AR organiza los puntos siguiendo una **Curva de Morton**. Es una forma de mapear datos 2D a 1D preservando la localidad.

### ¿Cómo funciona?
Intercalamos los bits de las coordenadas `x` e `y` para generar un índice único. Al ordenar los puntos por este índice, logramos que los puntos que están cerca en el espacio físico de la imagen siempre estén cerca en el array de datos.

## ¿Por qué es una innovación disruptiva?

### 1. Entropía "Curada"
Al estar los puntos cercanos agrupados, los descriptores de esos puntos suelen ser similares (porque ven partes parecidas de la imagen). 
- **Resultado en Compresión:** Los diferenciales de datos entre puntos adyacentes se vuelven muy pequeños, permitiendo que algoritmos de compresión delta o de diccionario (Brotli/Gzip) reduzcan el tamaño del archivo de forma espectacular.

### 2. Búsqueda Espacial Eficiente
Cuando el motor AR busca un punto en la imagen, gracias al orden de Morton, puede descartar regiones enteras de memoria rápidamente, acelerando la búsqueda jerárquica de clusters.

## Métricas de Impacto

- **Efectividad Gzip:** Mejora de la tasa de compresión en un **15-20% adicional** solo por el reordenamiento de los puntos.
- **Localidad de Cache:** Reducción estimada del **30%** en fallos de cache de CPU durante el matching de puntos.
- **Tamaño Final:** Esta técnica es "gratis" en términos de bytes, pero reduce el peso del archivo transferido por la red de forma invisible.
